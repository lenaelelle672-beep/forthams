package com.ams.service.impl;

import com.ams.common.exception.BizErrorCode;
import com.ams.common.exception.BusinessException;
import com.ams.service.EmailService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.mail.MailException;
import org.springframework.scheduling.annotation.Async;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;
    private final SpringTemplateEngine templateEngine;

    @Async("mailTaskExecutor")
    @Override
    public void sendEmail(String to, String subject, String body) {
        sendMimeMessage(to, subject, body, false, null);
    }

    @Async("mailTaskExecutor")
    @Override
    public void sendHtmlEmail(String to, String subject, String htmlBody) {
        sendMimeMessage(to, subject, htmlBody, true, null);
    }

    @Async("mailTaskExecutor")
    @Override
    public void sendTemplateEmail(String to, String subject, String templateName, Map<String, Object> variables) {
        Context context = new Context();
        if (variables != null) {
            context.setVariables(variables);
        }
        String html = templateEngine.process("email/" + templateName, context);
        sendMimeMessage(to, subject, html, true, null);
    }

    @Override
    public void sendEmailWithAttachment(String to, String subject, String body, File attachment) {
        sendMimeMessage(to, subject, body, false, attachment);
    }

    private void sendMimeMessage(String to, String subject, String content, boolean isHtml, File attachment) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(content, isHtml);
            if (attachment != null && attachment.exists()) {
                helper.addAttachment(attachment.getName(), new FileSystemResource(attachment));
            }
            mailSender.send(message);
            log.info("[Email] 发送成功: to={}, subject={}", to, subject);
        } catch (MailException e) {
            log.error("[Email] 发送失败: to={}, subject={}", to, subject, e);
            throw new BusinessException(BizErrorCode.EMAIL_SEND_FAILED, "邮件发送失败: " + e.getMessage(), e);
        } catch (MessagingException e) {
            log.error("[Email] 消息构造失败: to={}, subject={}", to, subject, e);
            throw new BusinessException(BizErrorCode.EMAIL_SEND_FAILED, "邮件消息构造失败", e);
        }
    }
}
