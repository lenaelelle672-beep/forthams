package com.ams.scheduler;

import com.ams.entity.MailLog;
import com.ams.service.EmailChannel;
import com.ams.service.MailLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 邮件发送失败重试定时任务
 *
 * <p>每 5 分钟扫描状态为 FAILED 且未达最大重试次数的邮件日志，
 * 调用 EmailChannel#retrySend(MailLog) 重新发送。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MailLogRetryScheduler {

    private final MailLogService mailLogService;
    private final EmailChannel emailChannel;

    /**
     * 每 5 分钟扫描并重试失败邮件
     */
    @Scheduled(fixedDelay = 300_000)
    public void retryFailedMails() {
        log.debug("MailLogRetryScheduler: scanning failed mails...");
        List<MailLog> pending;
        try {
            pending = mailLogService.getPendingRetry(3);
        } catch (Exception e) {
            log.warn("MailLogRetryScheduler: skip retry scan: {}", e.getClass().getSimpleName());
            return;
        }
        if (pending.isEmpty()) {
            return;
        }
        log.info("MailLogRetryScheduler: found {} failed mails to retry", pending.size());
        for (MailLog mailLog : pending) {
            try {
                emailChannel.retrySend(mailLog);
            } catch (Exception e) {
                log.error("MailLogRetryScheduler: retry send failed for mailLogId={}: {}", mailLog.getId(), e.getMessage());
            }
        }
    }
}
