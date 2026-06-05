package com.ams.service;

/**
 * 邮件发送服务接口。
 */
public interface EmailService {

    /**
     * 发送简单文本邮件。
     *
     * @param to      收件人邮箱
     * @param subject 邮件主题
     * @param body    邮件正文
     */
    void sendEmail(String to, String subject, String body);
}
