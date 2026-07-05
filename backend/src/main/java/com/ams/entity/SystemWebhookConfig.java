package com.ams.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("system_webhook_config")
public class SystemWebhookConfig implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;
    private String configName;
    private String eventType;
    private String targetUrl;
    private Boolean enabled;
    private String status;
    private String signingStrategy;
    private Boolean secretConfigured;
    private Boolean signatureConfigured;
    private String maskedHeaderNames;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
