package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 邮件发送日志实体
 *
 * <p>记录每次邮件发送的完整信息（收件人、主题、发送状态、重试等），
 * 支持失败重试和按业务类型追踪。</p>
 */
@Data
@TableName("sys_mail_log")
public class MailLog implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 租户ID */
    private String tenantId;

    /** 模板编码 */
    private String templateCode;

    /** 发件人 */
    private String mailFrom;

    /** 收件人（多个用逗号分隔） */
    private String mailTo;

    /** 抄送 */
    private String mailCc;

    /** 密送 */
    private String mailBcc;

    /** 邮件主题 */
    private String subject;

    /** 邮件正文（渲染后 HTML） */
    private String content;

    /** 发送状态：PENDING/SUCCESS/FAILED */
    private String sendStatus;

    /** 失败原因 */
    private String errorMessage;

    /** 已重试次数 */
    private Integer retryCount;

    /** 最大重试次数 */
    private Integer maxRetry;

    /** 业务类型 */
    private String bizType;

    /** 业务ID */
    private Long bizId;

    /** 发送时间 */
    private LocalDateTime sendTime;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
