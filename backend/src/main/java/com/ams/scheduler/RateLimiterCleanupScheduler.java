package com.ams.scheduler;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class RateLimiterCleanupScheduler {

    @Scheduled(fixedDelay = 300_000)
    public void cleanupExpiredBuckets() {
        // RateLimiter 已删除，限流由 RateLimitFilter 滑动窗口实现接管。
        // 滑动窗口的惰性清理（窗口外旧时间戳在请求到达时自动移除）无需定时任务。
        log.debug("rate_limiter_cleanup skipped (RateLimiter removed, sliding window handles cleanup)");
    }
}
