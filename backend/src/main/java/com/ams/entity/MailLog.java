package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("mail_log")
public class MailLog {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String templateCode;
    private String mailFrom;
    private String mailTo;
    private String mailCc;
    private String mailBcc;
    private String subject;
    private String content;
    private String sendStatus;
    private String errorMessage;
    private Integer retryCount;
    private Integer maxRetry;
    private String bizType;
    private Long bizId;
    private String provider;
    private String providerMessageId;
    private String requestId;
    private String headers;
    private String payload;
    private LocalDateTime sendTime;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
