package com.ams.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * 邮件发送服务
 *
 * <p>基于 Spring {@link JavaMailSender} 实现异步邮件发送。
 * 当 {@code JavaMailSender} 未配置（SMTP 凭据缺失）时，静默跳过不抛异常。
 * 发送失败仅记 warn 日志，不阻塞主流程。</p>
 */
@Slf4j
@Service
public class EmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    /**
     * 异步发送简单文本邮件。
     *
     * @param to      收件人邮箱，为空或 null 时跳过
     * @param subject 邮件主题
     * @param content 邮件正文
     */
    @Async
    public void sendEmail(String to, String subject, String content) {
        if (mailSender == null) {
            log.warn("JavaMailSender not configured, skipping email to: {}", to);
            return;
        }
        if (to == null || to.isBlank()) {
            log.warn("No recipient email, skipping email. subject: {}", subject);
            return;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to.trim());
            message.setSubject(subject);
            message.setText(content);
            mailSender.send(message);
            log.info("Email sent to: {}, subject: {}", to, subject);
        } catch (Exception e) {
            log.warn("Failed to send email to: {}, subject: {}, error: {}", to, subject, e.getMessage());
        }
    }
}
