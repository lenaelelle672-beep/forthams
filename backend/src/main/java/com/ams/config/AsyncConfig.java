package com.ams.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * 异步任务配置
 *
 * <p>启用异步方法执行 ({@link EnableAsync})，为通知渠道提供独立的线程池，
 * 避免邮件/GIMI等发送操作占用 Web 容器线程。</p>
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * 通知发送专用线程池
     */
    @Bean(name = "notificationExecutor")
    public Executor notificationExecutor() {
        return buildExecutor("notification-");
    }

    /**
     * 邮件发送专用线程池
     */
    @Bean(name = "mailTaskExecutor")
    public Executor mailTaskExecutor() {
        return buildExecutor("mail-");
    }

    private Executor buildExecutor(String threadNamePrefix) {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix(threadNamePrefix);
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}
