package com.ams.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 有界的本地测试/开发登录失败状态。生产环境不注册本实现，必须显式使用共享数据库 tracker。
 */
@Component
@Profile({"test", "dev"})
@ConditionalOnProperty(name = "app.security.login-rate-limit.tracker", havingValue = "memory")
public class InMemoryLoginAttemptTracker implements LoginAttemptTracker {

    private static final String ACCOUNT_BUCKET = "ACCOUNT";
    private static final String IP_BUCKET = "IP";
    private static final Pattern HASH = Pattern.compile("[0-9a-f]{64}");
    private static final int MAX_FAILURE_COUNT = 64;

    private final Clock clock;
    private final int maxEntries;
    private final int failuresBeforeBackoff;
    private final Duration baseDelay;
    private final Duration maxDelay;
    private final Duration retention;
    private final Duration reservationTtl;
    private final Map<BucketKey, BucketState> buckets = new LinkedHashMap<>();
    private final Map<String, ReservationState> reservations = new HashMap<>();

    @Autowired
    public InMemoryLoginAttemptTracker(
            @Value("${app.security.login-rate-limit.max-entries:10000}") int maxEntries,
            @Value("${app.security.login-rate-limit.failures-before-backoff:5}") int failuresBeforeBackoff,
            @Value("${app.security.login-rate-limit.base-delay-seconds:1}") long baseDelaySeconds,
            @Value("${app.security.login-rate-limit.max-delay-seconds:900}") long maxDelaySeconds,
            @Value("${app.security.login-rate-limit.retention-seconds:86400}") long retentionSeconds,
            @Value("${app.security.login-rate-limit.reservation-seconds:120}") long reservationSeconds) {
        this(Clock.systemUTC(), maxEntries, failuresBeforeBackoff, Duration.ofSeconds(baseDelaySeconds),
                Duration.ofSeconds(maxDelaySeconds), Duration.ofSeconds(retentionSeconds),
                Duration.ofSeconds(reservationSeconds));
    }

    InMemoryLoginAttemptTracker(Clock clock, int maxEntries, int failuresBeforeBackoff,
                                 Duration baseDelay, Duration maxDelay, Duration retention,
                                 Duration reservationTtl) {
        this.clock = clock;
        this.maxEntries = Math.max(1, maxEntries);
        this.failuresBeforeBackoff = Math.max(1, failuresBeforeBackoff);
        this.baseDelay = positiveDuration(baseDelay, Duration.ofSeconds(1));
        this.maxDelay = positiveDuration(maxDelay, this.baseDelay);
        this.retention = positiveDuration(retention, Duration.ofHours(24));
        this.reservationTtl = positiveDuration(reservationTtl, Duration.ofMinutes(2));
    }

    @Override
    public synchronized Optional<LoginAttemptReservation> reserve(String accountHash, String clientIpHash) {
        validateHashes(accountHash, clientIpHash);
        Instant now = clock.instant();
        reapExpiredReservations(now);
        purgeInactiveBuckets(now);

        List<BucketKey> keys = bucketKeys(accountHash, clientIpHash);
        for (BucketKey key : keys) {
            BucketState state = buckets.get(key);
            if (state != null && state.nextAllowedAt != null && state.nextAllowedAt.isAfter(now)) {
                return Optional.empty();
            }
        }
        int missingBuckets = (int) keys.stream().filter(key -> !buckets.containsKey(key)).count();
        if (buckets.size() + missingBuckets > maxEntries) {
            return Optional.empty();
        }
        for (BucketKey key : keys) {
            buckets.computeIfAbsent(key, ignored -> new BucketState(now.plus(retention)));
        }
        for (BucketKey key : keys) {
            if (!hasCapacity(buckets.get(key))) {
                return Optional.empty();
            }
        }

        String reservationId = UUID.randomUUID().toString();
        for (BucketKey key : keys) {
            BucketState state = buckets.get(key);
            state.reservedCount++;
            state.expiresAt = now.plus(retention);
        }
        reservations.put(reservationId, new ReservationState(accountHash, clientIpHash, now.plus(reservationTtl)));
        return Optional.of(new LoginAttemptReservation(reservationId));
    }

    @Override
    public synchronized void recordFailure(LoginAttemptReservation reservation) {
        ReservationState reservationState = takeReservation(reservation);
        Instant now = clock.instant();
        List<BucketKey> keys = bucketKeys(reservationState.accountHash, reservationState.clientIpHash);
        for (BucketKey key : keys) {
            BucketState state = requireBucket(key);
            state.reservedCount--;
            state.failureCount = Math.min(MAX_FAILURE_COUNT, state.failureCount + 1);
            state.nextAllowedAt = now.plus(backoffDelay(state.failureCount));
            state.expiresAt = now.plus(retention);
        }
        purgeInactiveBuckets(now);
    }

    @Override
    public synchronized void recordSuccess(LoginAttemptReservation reservation) {
        ReservationState reservationState = takeReservation(reservation);
        Instant now = clock.instant();
        BucketState accountState = requireBucket(new BucketKey(ACCOUNT_BUCKET, reservationState.accountHash));
        BucketState ipState = requireBucket(new BucketKey(IP_BUCKET, reservationState.clientIpHash));
        accountState.reservedCount--;
        ipState.reservedCount--;
        accountState.failureCount = 0;
        accountState.nextAllowedAt = now;
        accountState.expiresAt = now.plus(retention);
        ipState.failureCount = Math.max(0, ipState.failureCount - 1);
        ipState.nextAllowedAt = now.plus(backoffDelay(ipState.failureCount));
        ipState.expiresAt = now.plus(retention);
        purgeInactiveBuckets(now);
    }

    synchronized int trackedBucketCount() {
        Instant now = clock.instant();
        reapExpiredReservations(now);
        purgeInactiveBuckets(now);
        return buckets.size();
    }

    private ReservationState takeReservation(LoginAttemptReservation reservation) {
        if (reservation == null) {
            throw new IllegalArgumentException("登录限流预占不能为空");
        }
        Instant now = clock.instant();
        reapExpiredReservations(now);
        ReservationState reservationState = reservations.remove(reservation.id());
        if (reservationState == null) {
            throw new IllegalStateException("登录限流预占已过期或已结算");
        }
        return reservationState;
    }

    private void reapExpiredReservations(Instant now) {
        Iterator<Map.Entry<String, ReservationState>> iterator = reservations.entrySet().iterator();
        while (iterator.hasNext()) {
            ReservationState reservation = iterator.next().getValue();
            if (!reservation.expiresAt.isAfter(now)) {
                for (BucketKey key : bucketKeys(reservation.accountHash, reservation.clientIpHash)) {
                    BucketState state = requireBucket(key);
                    if (state.reservedCount < 1) {
                        throw new IllegalStateException("登录限流预占计数不一致");
                    }
                    state.reservedCount--;
                }
                iterator.remove();
            }
        }
    }

    private void purgeInactiveBuckets(Instant now) {
        Iterator<Map.Entry<BucketKey, BucketState>> iterator = buckets.entrySet().iterator();
        while (iterator.hasNext()) {
            BucketState state = iterator.next().getValue();
            if (state.reservedCount == 0 && (state.failureCount == 0 || !state.expiresAt.isAfter(now))) {
                iterator.remove();
            }
        }
    }

    private boolean hasCapacity(BucketState state) {
        if (state.failureCount < failuresBeforeBackoff) {
            return state.failureCount + state.reservedCount < failuresBeforeBackoff;
        }
        return state.reservedCount == 0;
    }

    private BucketState requireBucket(BucketKey key) {
        BucketState state = buckets.get(key);
        if (state == null) {
            throw new IllegalStateException("登录限流 bucket 状态不完整");
        }
        return state;
    }

    private List<BucketKey> bucketKeys(String accountHash, String clientIpHash) {
        List<BucketKey> keys = new ArrayList<>(List.of(
                new BucketKey(ACCOUNT_BUCKET, accountHash), new BucketKey(IP_BUCKET, clientIpHash)));
        keys.sort(BucketKey::compareTo);
        return keys;
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

    private static Duration positiveDuration(Duration value, Duration fallback) {
        return value == null || value.isZero() || value.isNegative() ? fallback : value;
    }

    private record BucketKey(String type, String hash) implements Comparable<BucketKey> {
        @Override
        public int compareTo(BucketKey other) {
            int typeComparison = type.compareTo(other.type);
            return typeComparison != 0 ? typeComparison : hash.compareTo(other.hash);
        }
    }

    private static final class BucketState {
        private int failureCount;
        private int reservedCount;
        private Instant nextAllowedAt;
        private Instant expiresAt;

        private BucketState(Instant expiresAt) {
            this.nextAllowedAt = Instant.EPOCH;
            this.expiresAt = expiresAt;
        }
    }

    private record ReservationState(String accountHash, String clientIpHash, Instant expiresAt) {
    }
}
