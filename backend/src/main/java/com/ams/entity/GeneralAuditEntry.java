package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("general_audit_entry")
public class GeneralAuditEntry {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String traceId;
    private LocalDateTime timestamp;
    private String action;
    private String operationType;
    private Long operatorId;
    private String operatorName;
    private String resourceType;
    private String resourceId;
    private String description;
    private String httpMethod;
    private String requestUri;
    private String ipAddress;
    private String userAgent;
    private String beforeRecord;
    private String afterRecord;
    private String rawPayload;
    private String errorMessage;
    private String errorStack;
    private String status;
    private LocalDateTime createdAt;
}
