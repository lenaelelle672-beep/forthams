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
@TableName("sla_timeout_record")
public class SlaTimeoutRecord implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long configId;
    private String processInstanceId;
    private String processKey;
    private String businessType;
    private String nodeKey;
    private String nodeName;
    private String priority;
    private LocalDateTime responseDueAt;
    private LocalDateTime resolveDueAt;
    private LocalDateTime timeoutAt;
    private Long timeoutMinutes;
    private String riskLevel;
    private String status;
    private String maskedBusinessSummary;
    private String applicantMasked;
    private String assigneeMasked;
    private String auditSummary;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
