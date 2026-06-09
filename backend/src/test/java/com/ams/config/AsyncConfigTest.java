package com.ams.config;

import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

class AsyncConfigTest {

    private final AsyncConfig config = new AsyncConfig();

    @Test
    void notificationExecutorShouldKeepConfiguredThreadPool() {
        Executor executor = config.notificationExecutor();

        ThreadPoolTaskExecutor taskExecutor = assertInstanceOf(ThreadPoolTaskExecutor.class, executor);
        try {
            assertExecutorConfig(taskExecutor, "notification-");
        } finally {
            taskExecutor.shutdown();
        }
    }

    @Test
    void mailTaskExecutorShouldExistForEmailAsyncMethods() {
        Executor executor = config.mailTaskExecutor();

        ThreadPoolTaskExecutor taskExecutor = assertInstanceOf(ThreadPoolTaskExecutor.class, executor);
        try {
            assertExecutorConfig(taskExecutor, "mail-");
        } finally {
            taskExecutor.shutdown();
        }
    }

    private void assertExecutorConfig(ThreadPoolTaskExecutor taskExecutor, String threadNamePrefix) {
        assertEquals(2, taskExecutor.getCorePoolSize());
        assertEquals(5, taskExecutor.getMaxPoolSize());
        assertEquals(50, taskExecutor.getQueueCapacity());
        assertEquals(threadNamePrefix, taskExecutor.getThreadNamePrefix());
        assertInstanceOf(ThreadPoolExecutor.CallerRunsPolicy.class, taskExecutor.getThreadPoolExecutor().getRejectedExecutionHandler());
    }
}
