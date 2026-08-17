package com.ams.security;

import com.ams.dto.LoginRequest;
import com.ams.mapper.SysTenantMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.ams.service.AuditService;
import com.ams.service.AuthService;
import com.ams.service.impl.UserDetailsServiceImpl;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.transaction.TransactionSystemException;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DatabaseLoginAttemptTrackerIntegrationTest {

    private JdbcTemplate jdbcTemplate;
    private MutableClock clock;
    private String databaseUrl;

    @BeforeEach
    void setUp() {
        databaseUrl = "jdbc:h2:mem:login_attempt_tracker_test;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000";
        DriverManagerDataSource dataSource = new DriverManagerDataSource(databaseUrl, "sa", "");
        jdbcTemplate = new JdbcTemplate(dataSource);
        jdbcTemplate.execute("DROP TABLE IF EXISTS login_attempt_reservation");
        jdbcTemplate.execute("DROP TABLE IF EXISTS login_attempt_bucket");
        jdbcTemplate.execute("DROP TABLE IF EXISTS login_attempt_bucket_guard");
        jdbcTemplate.execute("""
                CREATE TABLE login_attempt_bucket (
                    bucket_type VARCHAR(16) NOT NULL,
                    bucket_hash VARCHAR(64) NOT NULL,
                    failure_count INT NOT NULL,
                    reserved_count INT NOT NULL,
                    next_allowed_at TIMESTAMP NOT NULL,
                    last_failure_at TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    PRIMARY KEY (bucket_type, bucket_hash)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE login_attempt_reservation (
                    reservation_id VARCHAR(36) NOT NULL PRIMARY KEY,
                    account_hash VARCHAR(64) NOT NULL,
                    client_ip_hash VARCHAR(64) NOT NULL,
                    expires_at TIMESTAMP NOT NULL
                )
                """);
        jdbcTemplate.execute("CREATE TABLE login_attempt_bucket_guard (id TINYINT NOT NULL PRIMARY KEY)");
        jdbcTemplate.update("INSERT INTO login_attempt_bucket_guard (id) VALUES (1)");
        clock = new MutableClock(Instant.parse("2026-08-03T00:00:00Z"));
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.execute("DROP TABLE IF EXISTS login_attempt_reservation");
        jdbcTemplate.execute("DROP TABLE IF EXISTS login_attempt_bucket");
        jdbcTemplate.execute("DROP TABLE IF EXISTS login_attempt_bucket_guard");
    }

    @Test
    void separateTrackerInstancesAtomicallyReserveOnlyThresholdAttempts() throws Exception {
        DatabaseLoginAttemptTracker first = tracker(40, 3, Duration.ofHours(1));
        DatabaseLoginAttemptTracker second = tracker(40, 3, Duration.ofHours(1));
        String account = hash('a');
        CountDownLatch ready = new CountDownLatch(10);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(10);
        List<Future<Optional<LoginAttemptReservation>>> futures = new ArrayList<>();
        try {
            for (int index = 0; index < 10; index++) {
                DatabaseLoginAttemptTracker tracker = index % 2 == 0 ? first : second;
                String clientIp = hash(Character.forDigit(index, 16));
                futures.add(executor.submit(() -> reserveAfterStart(tracker, account, clientIp, ready, start)));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            List<LoginAttemptReservation> reservations = new ArrayList<>();
            for (Future<Optional<LoginAttemptReservation>> future : futures) {
                future.get(10, TimeUnit.SECONDS).ifPresent(reservations::add);
            }
            assertThat(reservations).hasSize(3);
            assertThat(bucketReservedCount("ACCOUNT", account)).isEqualTo(3);

            for (LoginAttemptReservation reservation : reservations) {
                first.recordFailure(reservation);
            }
            assertThat(second.reserve(account, hash('f'))).isEmpty();
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void accountBucketBlocksRotatingIpsIndependentlyOfPair() {
        DatabaseLoginAttemptTracker tracker = tracker(20, 2, Duration.ofHours(1));
        String account = hash('a');

        fail(tracker, account, hash('b'));
        fail(tracker, account, hash('c'));

        assertThat(tracker.reserve(account, hash('d'))).isEmpty();
        assertThat(bucketFailureCount("ACCOUNT", account)).isEqualTo(2);
    }

    @Test
    void ipBucketBlocksMultipleAccountsIndependentlyOfPair() {
        DatabaseLoginAttemptTracker tracker = tracker(20, 2, Duration.ofHours(1));
        String clientIp = hash('f');

        fail(tracker, hash('a'), clientIp);
        fail(tracker, hash('b'), clientIp);

        assertThat(tracker.reserve(hash('c'), clientIp)).isEmpty();
        assertThat(bucketFailureCount("IP", clientIp)).isEqualTo(2);
    }

    @Test
    void thresholdBoundaryAllowsOneProbeAfterEachCompletedBackoffWindow() {
        DatabaseLoginAttemptTracker tracker = tracker(20, 2, Duration.ofHours(1));
        String account = hash('a');
        String clientIp = hash('b');

        fail(tracker, account, clientIp);
        fail(tracker, account, clientIp);
        assertThat(tracker.reserve(account, clientIp)).isEmpty();

        clock.advance(Duration.ofSeconds(10));
        LoginAttemptReservation nextProbe = reserve(tracker, account, clientIp);
        tracker.recordFailure(nextProbe);
        assertThat(tracker.reserve(account, clientIp)).isEmpty();

        clock.advance(Duration.ofSeconds(20));
        LoginAttemptReservation allowedAfterEscalation = reserve(tracker, account, clientIp);
        tracker.recordSuccess(allowedAfterEscalation);
    }

    @Test
    void successClearsAccountFailuresAndDecaysOnlyTheSharedIpBucket() {
        DatabaseLoginAttemptTracker tracker = tracker(20, 3, Duration.ofHours(1));
        String sharedIp = hash('f');
        String successfulAccount = hash('a');
        LoginAttemptReservation successfulReservation = reserve(tracker, successfulAccount, sharedIp);

        fail(tracker, hash('b'), sharedIp);
        fail(tracker, hash('c'), sharedIp);
        assertThat(bucketFailureCount("IP", sharedIp)).isEqualTo(2);

        tracker.recordSuccess(successfulReservation);

        assertThat(bucketCount("ACCOUNT", successfulAccount)).isZero();
        assertThat(bucketFailureCount("IP", sharedIp)).isEqualTo(1);
        LoginAttemptReservation nextReservation = reserve(tracker, hash('d'), sharedIp);
        tracker.recordSuccess(nextReservation);
    }

    @Test
    void expiredReservationsRemainFailClosedUntilTheSharedCleanupReleasesThem() {
        DatabaseLoginAttemptTracker tracker = tracker(2, 1, Duration.ofHours(1));
        reserve(tracker, hash('a'), hash('b'));
        assertThat(tracker.reserve(hash('c'), hash('d'))).isEmpty();

        clock.advance(Duration.ofSeconds(31));

        LoginAttemptReservation replacement = reserve(tracker, hash('c'), hash('d'));
        tracker.recordSuccess(replacement);
        assertThat(tracker.trackedBucketCount()).isZero();
    }

    @Test
    void transactionFailureDoesNotProduceAnAllowedReservation() {
        TransactionTemplate failingTransaction = mock(TransactionTemplate.class);
        when(failingTransaction.execute(any())).thenThrow(new TransactionSystemException("transaction rolled back"));
        DatabaseLoginAttemptTracker tracker = new DatabaseLoginAttemptTracker(jdbcTemplate, failingTransaction, clock,
                20, 2, Duration.ofSeconds(10), Duration.ofMinutes(5), Duration.ofHours(1), Duration.ofSeconds(30));

        assertThatThrownBy(() -> tracker.reserve(hash('a'), hash('b')))
                .isInstanceOf(TransactionSystemException.class);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM login_attempt_reservation", Integer.class))
                .isZero();
    }

    @Test
    void twoAuthServicesOnSeparateTrackersCannotSendMoreThanThresholdRequestsToPasswordVerification() throws Exception {
        DatabaseLoginAttemptTracker firstTracker = tracker(40, 3, Duration.ofHours(1));
        DatabaseLoginAttemptTracker secondTracker = tracker(40, 3, Duration.ofHours(1));
        AtomicInteger passwordChecks = new AtomicInteger();
        AuthService firstService = authService(firstTracker, passwordChecks);
        AuthService secondService = authService(secondTracker, passwordChecks);
        CountDownLatch ready = new CountDownLatch(10);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(10);
        List<Future<?>> futures = new ArrayList<>();
        try {
            for (int index = 0; index < 10; index++) {
                AuthService service = index % 2 == 0 ? firstService : secondService;
                String clientIp = "203.0.113." + (index + 1);
                futures.add(executor.submit(() -> loginAfterStart(service, clientIp, ready, start)));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            for (Future<?> future : futures) {
                future.get(10, TimeUnit.SECONDS);
            }
        } finally {
            executor.shutdownNow();
        }

        assertThat(passwordChecks).hasValue(3);
    }

    private DatabaseLoginAttemptTracker tracker(int maxEntries, int failuresBeforeBackoff, Duration retention) {
        DriverManagerDataSource isolatedContextDataSource = new DriverManagerDataSource(databaseUrl, "sa", "");
        JdbcTemplate isolatedContextJdbcTemplate = new JdbcTemplate(isolatedContextDataSource);
        return new DatabaseLoginAttemptTracker(isolatedContextJdbcTemplate,
                new TransactionTemplate(new DataSourceTransactionManager(isolatedContextDataSource)), clock,
                maxEntries, failuresBeforeBackoff, Duration.ofSeconds(10), Duration.ofMinutes(5), retention,
                Duration.ofSeconds(30));
    }

    private AuthService authService(DatabaseLoginAttemptTracker tracker, AtomicInteger passwordChecks) {
        AuthenticationManager rejectingPasswordVerification = authentication -> {
            passwordChecks.incrementAndGet();
            throw new BadCredentialsException("invalid credentials");
        };
        return new AuthService(mock(UserMapper.class), mock(JwtUtil.class), rejectingPasswordVerification,
                mock(SysTenantMapper.class), mock(UserDetailsServiceImpl.class), mock(UserTenantMembershipMapper.class),
                mock(UserRoleMapper.class),
                tracker, new LoginAttemptKeyHasher("integration-test-login-rate-limit-secret"), mock(AuditService.class));
    }

    private Optional<LoginAttemptReservation> reserveAfterStart(DatabaseLoginAttemptTracker tracker, String account,
                                                                 String clientIp, CountDownLatch ready,
                                                                 CountDownLatch start) {
        try {
            ready.countDown();
            if (!start.await(10, TimeUnit.SECONDS)) {
                throw new AssertionError("并发限流测试未同步启动");
            }
            return tracker.reserve(account, clientIp);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AssertionError(exception);
        }
    }

    private void loginAfterStart(AuthService service, String clientIp, CountDownLatch ready, CountDownLatch start) {
        try {
            ready.countDown();
            if (!start.await(10, TimeUnit.SECONDS)) {
                throw new AssertionError("并发认证测试未同步启动");
            }
            LoginRequest request = new LoginRequest();
            request.setUsername("same-account");
            request.setPassword("wrong-password");
            service.login(request, clientIp);
            throw new AssertionError("错误密码不应认证成功");
        } catch (AuthenticationException expected) {
            // 每个调用都应得到统一认证失败；仅阈值内调用会进入 AuthenticationManager。
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AssertionError(exception);
        }
    }

    private LoginAttemptReservation reserve(DatabaseLoginAttemptTracker tracker, String account, String clientIp) {
        return tracker.reserve(account, clientIp).orElseThrow(() -> new AssertionError("预期登录额度可用"));
    }

    private void fail(DatabaseLoginAttemptTracker tracker, String account, String clientIp) {
        tracker.recordFailure(reserve(tracker, account, clientIp));
    }

    private int bucketFailureCount(String bucketType, String bucketHash) {
        return jdbcTemplate.queryForObject("""
                SELECT failure_count
                FROM login_attempt_bucket
                WHERE bucket_type = ? AND bucket_hash = ?
                """, Integer.class, bucketType, bucketHash);
    }

    private int bucketReservedCount(String bucketType, String bucketHash) {
        return jdbcTemplate.queryForObject("""
                SELECT reserved_count
                FROM login_attempt_bucket
                WHERE bucket_type = ? AND bucket_hash = ?
                """, Integer.class, bucketType, bucketHash);
    }

    private int bucketCount(String bucketType, String bucketHash) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM login_attempt_bucket
                WHERE bucket_type = ? AND bucket_hash = ?
                """, Integer.class, bucketType, bucketHash);
        return count == null ? 0 : count;
    }

    private String hash(char value) {
        return String.valueOf(value).repeat(64);
    }

    private static final class MutableClock extends Clock {
        private Instant instant;

        private MutableClock(Instant instant) {
            this.instant = instant;
        }

        @Override
        public ZoneId getZone() {
            return ZoneId.of("UTC");
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return instant;
        }

        private void advance(Duration duration) {
            instant = instant.plus(duration);
        }
    }
}
