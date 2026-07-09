package com.ams.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("system_external_system")
public class SystemExternalSystem implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;
    private String systemCode;
    private String systemName;
    private String systemType;
    private String baseUrlMasked;
    private String authType;
    private String authConfigSummary;
    private Boolean authConfigured;
    private Boolean configMasked;
    private String maskedSecretSummary;
    private String secretFingerprint;
    private Boolean enabled;
    private String status;
    private String healthStatus;
    private String lastValidationStatus;
    private String lastValidationMessage;
    private LocalDateTime lastValidationAt;
    private Long lastOperatorId;
    private String lastOperation;
    private String lastOperationReason;
    private String auditEvidenceSummary;
    private Integer removed;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
