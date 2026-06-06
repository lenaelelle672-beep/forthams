package com.ams.service;

import java.io.File;
import java.util.Map;

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

    /**
     * 发送模板邮件（Thymeleaf 渲染 HTML）。
     *
     * @param to           收件人邮箱
     * @param subject      邮件主题
     * @param templateName 模板名称（不含 .html 后缀）
     * @param variables    模板变量
     */
    void sendTemplateEmail(String to, String subject, String templateName, Map<String, Object> variables);

    /**
     * 发送带附件的邮件。
     *
     * @param to         收件人邮箱
     * @param subject    邮件主题
     * @param body       邮件正文
     * @param attachment 附件文件
     */
    void sendEmailWithAttachment(String to, String subject, String body, File attachment);

    /**
     * 发送 HTML 格式邮件。
     *
     * @param to       收件人邮箱
     * @param subject  邮件主题
     * @param htmlBody HTML 正文
     */
    void sendHtmlEmail(String to, String subject, String htmlBody);

    /**
     * 发送 HTML 邮件（支持抄送）。
     *
     * @param to       收件人邮箱
     * @param cc       抄送列表
     * @param bcc      密送列表（可为 null）
     * @param subject  邮件主题
     * @param htmlBody HTML 正文
     */
    void sendHtmlEmailWithCc(String to, java.util.List<String> cc, java.util.List<String> bcc, String subject, String htmlBody);
}
