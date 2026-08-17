package com.ams.security;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class InMemoryLoginAttemptTrackerTest {

    @Test
    void preReservesBothBucketsAndAppliesProgressiveBackoffAfterFailures() {
        MutableClock clock = new MutableClock(Instant.parse("2026-08-03T00:00:00Z"));
        InMemoryLoginAttemptTracker tracker = tracker(clock, 20, 2);
        String account = hash('a');
        String clientIp = hash('b');

        tracker.recordFailure(reserve(tracker, account, clientIp));
        tracker.recordFailure(reserve(tracker, account, clientIp));
        assertThat(tracker.reserve(account, clientIp)).isEmpty();

        clock.advance(Duration.ofSeconds(1));
        tracker.recordFailure(reserve(tracker, account, clientIp));
        assertThat(tracker.reserve(account, clientIp)).isEmpty();

        clock.advance(Duration.ofSeconds(2));
        tracker.recordSuccess(reserve(tracker, account, clientIp));
    }

    @Test
    void successfulLoginClearsAccountStateAndDecaysIpState() {
        MutableClock clock = new MutableClock(Instant.parse("2026-08-03T00:00:00Z"));
        InMemoryLoginAttemptTracker tracker = tracker(clock, 20, 3);
        String sharedIp = hash('f');
        LoginAttemptReservation successfulReservation = reserve(tracker, hash('a'), sharedIp);

        tracker.recordFailure(reserve(tracker, hash('b'), sharedIp));
        tracker.recordFailure(reserve(tracker, hash('c'), sharedIp));
        tracker.recordSuccess(successfulReservation);

        LoginAttemptReservation nextReservation = reserve(tracker, hash('d'), sharedIp);
        tracker.recordSuccess(nextReservation);
    }

    @Test
    void boundedTestTrackerFailsClosedInsteadOfEvictingActiveBuckets() {
        MutableClock clock = new MutableClock(Instant.parse("2026-08-03T00:00:00Z"));
        InMemoryLoginAttemptTracker tracker = tracker(clock, 2, 2);

        LoginAttemptReservation first = reserve(tracker, hash('a'), hash('b'));
        assertThat(tracker.reserve(hash('c'), hash('d'))).isEmpty();
        tracker.recordSuccess(first);
        assertThat(tracker.trackedBucketCount()).isZero();
    }

    private InMemoryLoginAttemptTracker tracker(MutableClock clock, int maxEntries, int failuresBeforeBackoff) {
        return new InMemoryLoginAttemptTracker(clock, maxEntries, failuresBeforeBackoff,
                Duration.ofSeconds(1), Duration.ofSeconds(10), Duration.ofHours(1), Duration.ofSeconds(30));
    }

    private LoginAttemptReservation reserve(InMemoryLoginAttemptTracker tracker, String account, String clientIp) {
        return tracker.reserve(account, clientIp).orElseThrow(() -> new AssertionError("预期登录额度可用"));
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
