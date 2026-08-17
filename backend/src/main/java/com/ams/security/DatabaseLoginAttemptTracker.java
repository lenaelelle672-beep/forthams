package com.ams.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 由共享数据库保存的登录退避状态。账户和来源地址在进入本组件前已被 HMAC 化；每次认证先
 * 原子预占账号和 IP 两个 bucket，再进入密码校验，避免多个应用实例同时越过阈值。
 */
@Component
@ConditionalOnProperty(name = "app.security.login-rate-limit.tracker", havingValue = "database", matchIfMissing = true)
public class DatabaseLoginAttemptTracker implements LoginAttemptTracker {

    private static final String ACCOUNT_BUCKET = "ACCOUNT";
    private static final String IP_BUCKET = "IP";
    private static final Pattern HASH = Pattern.compile("[0-9a-f]{64}");
    private static final int MAX_FAILURE_COUNT = 64;
    private static final int RESERVE_RETRY_LIMIT = 3;

    private final JdbcTemplate jdbcTemplate;
    private final TransactionTemplate transactionTemplate;
    private final Clock clock;
    private final int maxEntries;
    private final int failuresBeforeBackoff;
    private final Duration baseDelay;
    private final Duration maxDelay;
    private final Duration retention;
    private final Duration reservationTtl;

    @Autowired
    public DatabaseLoginAttemptTracker(
            JdbcTemplate jdbcTemplate,
            PlatformTransactionManager transactionManager,
            @Value("${app.security.login-rate-limit.max-entries:10000}") int maxEntries,
            @Value("${app.security.login-rate-limit.failures-before-backoff:5}") int failuresBeforeBackoff,
            @Value("${app.security.login-rate-limit.base-delay-seconds:1}") long baseDelaySeconds,
            @Value("${app.security.login-rate-limit.max-delay-seconds:900}") long maxDelaySeconds,
            @Value("${app.security.login-rate-limit.retention-seconds:86400}") long retentionSeconds,
            @Value("${app.security.login-rate-limit.reservation-seconds:120}") long reservationSeconds) {
        this(jdbcTemplate, newTransactionTemplate(transactionManager), Clock.systemUTC(), maxEntries,
                failuresBeforeBackoff, Duration.ofSeconds(baseDelaySeconds), Duration.ofSeconds(maxDelaySeconds),
                Duration.ofSeconds(retentionSeconds), Duration.ofSeconds(reservationSeconds));
    }

    DatabaseLoginAttemptTracker(JdbcTemplate jdbcTemplate, TransactionTemplate transactionTemplate, Clock clock,
                                int maxEntries, int failuresBeforeBackoff, Duration baseDelay,
                                Duration maxDelay, Duration retention, Duration reservationTtl) {
        this.jdbcTemplate = jdbcTemplate;
        this.transactionTemplate = transactionTemplate;
        this.clock = clock;
        this.maxEntries = Math.max(1, maxEntries);
        this.failuresBeforeBackoff = Math.max(1, failuresBeforeBackoff);
        this.baseDelay = positiveDuration(baseDelay, Duration.ofSeconds(1));
        this.maxDelay = positiveDuration(maxDelay, this.baseDelay);
        this.retention = positiveDuration(retention, Duration.ofHours(24));
        this.reservationTtl = positiveDuration(reservationTtl, Duration.ofMinutes(2));
    }

    @Override
    public Optional<LoginAttemptReservation> reserve(String accountHash, String clientIpHash) {
        validateHashes(accountHash, clientIpHash);
        DuplicateKeyException lastConflict = null;
        for (int attempt = 0; attempt < RESERVE_RETRY_LIMIT; attempt++) {
            try {
                Optional<LoginAttemptReservation> reservation = transactionTemplate.execute(
                        status -> reserveLocked(accountHash, clientIpHash));
                if (reservation == null) {
                    throw new IllegalStateException("登录限流预占事务未返回结果");
                }
                return reservation;
            } catch (DuplicateKeyException exception) {
                // 部署交叠或手工写入仍可能绕过 guard；回滚后重新读取唯一 bucket 行。
                lastConflict = exception;
            }
        }
        throw new IllegalStateException("登录限流 bucket 并发创建冲突", lastConflict);
    }

    @Override
    public void recordFailure(LoginAttemptReservation reservation) {
        finalizeReservation(reservation, false);
    }

    @Override
    public void recordSuccess(LoginAttemptReservation reservation) {
        finalizeReservation(reservation, true);
    }

    int trackedBucketCount() {
        Long count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM login_attempt_bucket", Long.class);
        return count == null ? 0 : Math.toIntExact(count);
    }

    private Optional<LoginAttemptReservation> reserveLocked(String accountHash, String clientIpHash) {
        Instant now = clock.instant();
        lockGuard();
        reapExpiredReservations(now);
        purgeInactiveBuckets(now);

        List<BucketKey> bucketKeys = sortedBucketKeys(accountHash, clientIpHash);
        Map<BucketKey, BucketState> states = loadBucketStatesForUpdate(bucketKeys);
        if (states.values().stream().anyMatch(state -> isBlocked(state, now))) {
            return Optional.empty();
        }

        int missingBuckets = 0;
        for (BucketKey bucketKey : bucketKeys) {
            if (!states.containsKey(bucketKey)) {
                missingBuckets++;
            }
        }
        if (trackedBucketCount() + missingBuckets > maxEntries) {
            // 容量达到上限时不淘汰活跃或失败 bucket，保持 fail-closed。
            return Optional.empty();
        }
        for (BucketKey bucketKey : bucketKeys) {
            if (!states.containsKey(bucketKey)) {
                insertBucket(bucketKey, now);
            }
        }
        if (missingBuckets > 0) {
            states = loadBucketStatesForUpdate(bucketKeys);
        }
        if (states.size() != bucketKeys.size() || states.values().stream().anyMatch(state -> !hasCapacity(state))) {
            return Optional.empty();
        }

        String reservationId = UUID.randomUUID().toString();
        for (BucketKey bucketKey : bucketKeys) {
            incrementReservation(bucketKey, now);
        }
        jdbcTemplate.update("""
                        INSERT INTO login_attempt_reservation
                            (reservation_id, account_hash, client_ip_hash, expires_at)
                        VALUES (?, ?, ?, ?)
                        """,
                reservationId, accountHash, clientIpHash, timestamp(now.plus(reservationTtl)));
        return Optional.of(new LoginAttemptReservation(reservationId));
    }

    private void finalizeReservation(LoginAttemptReservation reservation, boolean successful) {
        validateReservation(reservation);
        transactionTemplate.executeWithoutResult(status -> finalizeReservationLocked(reservation, successful));
    }

    private void finalizeReservationLocked(LoginAttemptReservation reservation, boolean successful) {
        Instant now = clock.instant();
        lockGuard();
        reapExpiredReservations(now);

        ReservationState reservationState = loadReservationForUpdate(reservation.id());
        if (reservationState == null) {
            throw new IllegalStateException("登录限流预占已过期或已结算");
        }
        validateHashes(reservationState.accountHash(), reservationState.clientIpHash());
        List<BucketKey> bucketKeys = sortedBucketKeys(reservationState.accountHash(), reservationState.clientIpHash());
        Map<BucketKey, BucketState> states = loadBucketStatesForUpdate(bucketKeys);
        if (states.size() != bucketKeys.size()) {
            throw new IllegalStateException("登录限流 bucket 状态不完整");
        }
        for (BucketKey bucketKey : bucketKeys) {
            BucketState state = states.get(bucketKey);
            if (state.reservedCount() < 1) {
                throw new IllegalStateException("登录限流预占计数不一致");
            }
            decrementReservation(bucketKey);
        }

        BucketKey accountBucket = new BucketKey(ACCOUNT_BUCKET, reservationState.accountHash());
        BucketKey ipBucket = new BucketKey(IP_BUCKET, reservationState.clientIpHash());
        if (successful) {
            clearAccountFailures(accountBucket, now);
            decayIpFailures(ipBucket, states.get(ipBucket).failureCount(), now);
        } else {
            for (BucketKey bucketKey : bucketKeys) {
                int failures = Math.min(MAX_FAILURE_COUNT, states.get(bucketKey).failureCount() + 1);
                recordBucketFailure(bucketKey, failures, now);
            }
        }
        int deleted = jdbcTemplate.update("DELETE FROM login_attempt_reservation WHERE reservation_id = ?",
                reservation.id());
        if (deleted != 1) {
            throw new IllegalStateException("登录限流预占已变化");
        }
        purgeInactiveBuckets(now);
    }

    /**
     * 所有写路径均先锁此 guard，随后锁 reservation，最后按 (bucket_type, bucket_hash) 锁 bucket。
     * 该固定顺序同时覆盖首次建行、过期回收和结果结算，避免交叉账户/IP 请求形成死锁环。
     */
    private void lockGuard() {
        Integer guardId = jdbcTemplate.queryForObject(
                "SELECT id FROM login_attempt_bucket_guard WHERE id = 1 FOR UPDATE", Integer.class);
        if (guardId == null || guardId != 1) {
            throw new IllegalStateException("登录限流容量保护行缺失");
        }
    }

    private void reapExpiredReservations(Instant now) {
        List<ReservationState> expired = jdbcTemplate.query("""
                        SELECT account_hash, client_ip_hash
                        FROM login_attempt_reservation
                        WHERE expires_at <= ?
                        FOR UPDATE
                        """, (resultSet, rowNum) -> new ReservationState(
                        resultSet.getString("account_hash"), resultSet.getString("client_ip_hash")), timestamp(now));
        if (expired.isEmpty()) {
            return;
        }

        Map<BucketKey, Integer> expiredCounts = new HashMap<>();
        for (ReservationState state : expired) {
            validateHashes(state.accountHash(), state.clientIpHash());
            expiredCounts.merge(new BucketKey(ACCOUNT_BUCKET, state.accountHash()), 1, Integer::sum);
            expiredCounts.merge(new BucketKey(IP_BUCKET, state.clientIpHash()), 1, Integer::sum);
        }
        List<BucketKey> bucketKeys = new ArrayList<>(expiredCounts.keySet());
        bucketKeys.sort(Comparator.naturalOrder());
        Map<BucketKey, BucketState> states = loadBucketStatesForUpdate(bucketKeys);
        for (BucketKey bucketKey : bucketKeys) {
            BucketState state = states.get(bucketKey);
            int expiredCount = expiredCounts.get(bucketKey);
            if (state == null || state.reservedCount() < expiredCount) {
                throw new IllegalStateException("过期登录限流预占状态不一致");
            }
            decrementReservations(bucketKey, expiredCount);
        }
        jdbcTemplate.update("DELETE FROM login_attempt_reservation WHERE expires_at <= ?", timestamp(now));
    }

    private void purgeInactiveBuckets(Instant now) {
        jdbcTemplate.update("""
                        DELETE FROM login_attempt_bucket
                        WHERE reserved_count = 0
                          AND (expires_at <= ? OR failure_count = 0)
                        """, timestamp(now));
    }

    private Map<BucketKey, BucketState> loadBucketStatesForUpdate(List<BucketKey> bucketKeys) {
        Map<BucketKey, BucketState> states = new LinkedHashMap<>();
        for (BucketKey bucketKey : bucketKeys) {
            List<BucketState> matches = jdbcTemplate.query("""
                            SELECT failure_count, reserved_count, next_allowed_at
                            FROM login_attempt_bucket
                            WHERE bucket_type = ?
                              AND bucket_hash = ?
                            FOR UPDATE
                            """, (resultSet, rowNum) -> new BucketState(
                            resultSet.getInt("failure_count"), resultSet.getInt("reserved_count"),
                            resultSet.getTimestamp("next_allowed_at").toInstant()), bucketKey.type(), bucketKey.hash());
            if (!matches.isEmpty()) {
                states.put(bucketKey, matches.get(0));
            }
        }
        return states;
    }

    private ReservationState loadReservationForUpdate(String reservationId) {
        List<ReservationState> reservations = jdbcTemplate.query("""
                        SELECT account_hash, client_ip_hash
                        FROM login_attempt_reservation
                        WHERE reservation_id = ?
                        FOR UPDATE
                        """, (resultSet, rowNum) -> new ReservationState(
                        resultSet.getString("account_hash"), resultSet.getString("client_ip_hash")), reservationId);
        return reservations.isEmpty() ? null : reservations.get(0);
    }

    private void insertBucket(BucketKey bucketKey, Instant now) {
        jdbcTemplate.update("""
                        INSERT INTO login_attempt_bucket
                            (bucket_type, bucket_hash, failure_count, reserved_count, next_allowed_at,
                             last_failure_at, expires_at)
                        VALUES (?, ?, 0, 0, ?, NULL, ?)
                        """, bucketKey.type(), bucketKey.hash(), timestamp(now), timestamp(now.plus(retention)));
    }

    private void incrementReservation(BucketKey bucketKey, Instant now) {
        int updated = jdbcTemplate.update("""
                        UPDATE login_attempt_bucket
                        SET reserved_count = reserved_count + 1,
                            expires_at = ?
                        WHERE bucket_type = ?
                          AND bucket_hash = ?
                        """, timestamp(now.plus(retention)), bucketKey.type(), bucketKey.hash());
        if (updated != 1) {
            throw new IllegalStateException("登录限流 bucket 已变化");
        }
    }

    private void decrementReservation(BucketKey bucketKey) {
        decrementReservations(bucketKey, 1);
    }

    private void decrementReservations(BucketKey bucketKey, int count) {
        int updated = jdbcTemplate.update("""
                        UPDATE login_attempt_bucket
                        SET reserved_count = reserved_count - ?
                        WHERE bucket_type = ?
                          AND bucket_hash = ?
                          AND reserved_count >= ?
                        """, count, bucketKey.type(), bucketKey.hash(), count);
        if (updated != 1) {
            throw new IllegalStateException("登录限流预占计数已变化");
        }
    }

    private void recordBucketFailure(BucketKey bucketKey, int failures, Instant now) {
        int updated = jdbcTemplate.update("""
                        UPDATE login_attempt_bucket
                        SET failure_count = ?,
                            next_allowed_at = ?,
                            last_failure_at = ?,
                            expires_at = ?
                        WHERE bucket_type = ?
                          AND bucket_hash = ?
                        """, failures, timestamp(now.plus(backoffDelay(failures))), timestamp(now),
                timestamp(now.plus(retention)), bucketKey.type(), bucketKey.hash());
        if (updated != 1) {
            throw new IllegalStateException("登录限流失败状态已变化");
        }
    }

    private void clearAccountFailures(BucketKey accountBucket, Instant now) {
        int updated = jdbcTemplate.update("""
                        UPDATE login_attempt_bucket
                        SET failure_count = 0,
                            next_allowed_at = ?,
                            last_failure_at = NULL,
                            expires_at = ?
                        WHERE bucket_type = ?
                          AND bucket_hash = ?
                        """, timestamp(now), timestamp(now.plus(retention)), accountBucket.type(), accountBucket.hash());
        if (updated != 1) {
            throw new IllegalStateException("登录限流账号状态已变化");
        }
    }

    private void decayIpFailures(BucketKey ipBucket, int previousFailures, Instant now) {
        int failures = Math.max(0, previousFailures - 1);
        int updated;
        if (failures == 0) {
            updated = jdbcTemplate.update("""
                            UPDATE login_attempt_bucket
                            SET failure_count = 0,
                                next_allowed_at = ?,
                                last_failure_at = NULL,
                                expires_at = ?
                            WHERE bucket_type = ?
                              AND bucket_hash = ?
                            """, timestamp(now), timestamp(now.plus(retention)), ipBucket.type(), ipBucket.hash());
        } else {
            updated = jdbcTemplate.update("""
                            UPDATE login_attempt_bucket
                            SET failure_count = ?,
                                next_allowed_at = ?,
                                expires_at = ?
                            WHERE bucket_type = ?
                              AND bucket_hash = ?
                            """, failures, timestamp(now.plus(backoffDelay(failures))), timestamp(now.plus(retention)),
                    ipBucket.type(), ipBucket.hash());
        }
        if (updated != 1) {
            throw new IllegalStateException("登录限流 IP 状态已变化");
        }
    }

    private boolean isBlocked(BucketState state, Instant now) {
        return state.nextAllowedAt().isAfter(now);
    }

    private boolean hasCapacity(BucketState state) {
        if (state.failureCount() < failuresBeforeBackoff) {
            return state.failureCount() + state.reservedCount() < failuresBeforeBackoff;
        }
        // 已完成一个退避周期后，仅允许一个新的探测请求；其失败会进入下一档退避。
        return state.reservedCount() == 0;
    }

    private List<BucketKey> sortedBucketKeys(String accountHash, String clientIpHash) {
        List<BucketKey> bucketKeys = new ArrayList<>(List.of(
                new BucketKey(ACCOUNT_BUCKET, accountHash), new BucketKey(IP_BUCKET, clientIpHash)));
        bucketKeys.sort(Comparator.naturalOrder());
        return bucketKeys;
    }

    private Duration backoffDelay(int failures) {
        int escalation = failures - failuresBeforeBackoff + 1;
        if (escalation <= 0) {
            return Duration.ZERO;
        }
        Duration delay = baseDelay;
        for (int step = 1; step < escalation && delay.compareTo(maxDelay) < 0; step++) {
            if (delay.compareTo(maxDelay.dividedBy(2)) > 0) {
                return maxDelay;
            }
            delay = delay.multipliedBy(2);
        }
        return delay.compareTo(maxDelay) > 0 ? maxDelay : delay;
    }

    private void validateHashes(String accountHash, String clientIpHash) {
        if (accountHash == null || clientIpHash == null
                || !HASH.matcher(accountHash).matches() || !HASH.matcher(clientIpHash).matches()) {
            throw new IllegalArgumentException("登录限流标识格式不合法");
        }
    }

    private void validateReservation(LoginAttemptReservation reservation) {
        if (reservation == null) {
            throw new IllegalArgumentException("登录限流预占不能为空");
        }
    }

    private Timestamp timestamp(Instant instant) {
        return Timestamp.from(instant);
    }

    private static Duration positiveDuration(Duration value, Duration fallback) {
        return value == null || value.isZero() || value.isNegative() ? fallback : value;
    }

    private static TransactionTemplate newTransactionTemplate(PlatformTransactionManager transactionManager) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return template;
    }

    private record BucketKey(String type, String hash) implements Comparable<BucketKey> {
        @Override
        public int compareTo(BucketKey other) {
            int typeComparison = type.compareTo(other.type);
            return typeComparison != 0 ? typeComparison : hash.compareTo(other.hash);
        }
    }

    private record BucketState(int failureCount, int reservedCount, Instant nextAllowedAt) {
    }

    private record ReservationState(String accountHash, String clientIpHash) {
    }
}
