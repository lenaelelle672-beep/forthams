package com.ams.service;

import com.ams.entity.MailLog;
import com.ams.entity.NotificationRecord;
import com.ams.entity.User;
import com.ams.mapper.MailLogMapper;
import com.ams.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * 邮件通知渠道
 *
 * <p>通过 JavaMailSender 异步发送邮件通知。
 * 根据通知记录中的用户 ID 查询用户邮箱地址后发送。</p>
 */
@Component
@RequiredArgsConstructor
public class EmailChannel implements NotificationChannel {

    private static final Logger log = LoggerFactory.getLogger(EmailChannel.class);

    private final JavaMailSender mailSender;
    private final UserMapper userMapper;
    private final MailLogMapper mailLogMapper;

    @Override
    @Async("notificationExecutor")
    public void send(NotificationRecord record) {
        if (record.getUserId() == null || record.getUserId() == 0L) {
            log.debug("EmailChannel skipped: userId is null or 0");
            return;
        }

        User user = userMapper.selectById(record.getUserId());
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            log.debug("EmailChannel skipped: user not found or email empty for userId={}", record.getUserId());
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(user.getEmail());
            message.setSubject(record.getTitle());
            message.setText(record.getContent());
            mailSender.send(message);
            log.info("Email sent to {} for notification id={}", user.getEmail(), record.getId());
        } catch (Exception e) {
            log.warn("EmailChannel failed to send to userId={}: {}", record.getUserId(), e.getMessage());
        }
    }

    @Async("notificationExecutor")
    public void retrySend(MailLog mailLog) {
        if (mailLog == null) {
            return;
        }
        mailLog.setRetryCount(mailLog.getRetryCount() == null ? 1 : mailLog.getRetryCount() + 1);
        try {
            if (mailLog.getMailTo() == null || mailLog.getMailTo().isBlank()) {
                throw new IllegalArgumentException("mailTo is empty");
            }
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(mailLog.getMailTo().trim().split(",\\s*"));
            if (mailLog.getMailCc() != null && !mailLog.getMailCc().isBlank()) {
                message.setCc(mailLog.getMailCc().trim().split(",\\s*"));
            }
            if (mailLog.getMailBcc() != null && !mailLog.getMailBcc().isBlank()) {
                message.setBcc(mailLog.getMailBcc().trim().split(",\\s*"));
            }
            message.setSubject(mailLog.getSubject());
            message.setText(mailLog.getContent());
            mailSender.send(message);
            mailLog.setSendStatus("SUCCESS");
            mailLog.setErrorMessage(null);
            mailLog.setSendTime(LocalDateTime.now());
            log.info("MailLog retry sent: id={}, to={}", mailLog.getId(), mailLog.getMailTo());
        } catch (Exception e) {
            mailLog.setSendStatus("FAILED");
            mailLog.setErrorMessage(e.getMessage());
            log.warn("MailLog retry failed: id={}, error={}", mailLog.getId(), e.getMessage());
        }
        mailLogMapper.updateById(mailLog);
    }
}
