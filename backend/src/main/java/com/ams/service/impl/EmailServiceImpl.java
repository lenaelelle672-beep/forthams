package com.ams.service.impl;

import com.ams.service.EmailService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 邮件发送服务实现（桩实现，用于编译通过）。
 */
@Slf4j
@Service
public class EmailServiceImpl implements EmailService {

    @Override
    public void sendEmail(String to, String subject, String body) {
        log.info("发送邮件: to={}, subject={}", to, subject);
        // TODO: 集成实际邮件发送逻辑（如 Spring Mail / SMTP）
    }
}
