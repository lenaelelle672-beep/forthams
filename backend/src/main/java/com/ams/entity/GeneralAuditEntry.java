package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@TableName("general_audit_entry")
public class GeneralAuditEntry {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String traceId;

    @TableField("timestamp")
    private Date timestamp;

    private String action;

    private String beforeRecord;

    private String afterRecord;

    @TableField("operation_type")
    private String operationType;

    @TableField("operator_id")
    private String operatorId;

    @TableField("operator_name")
    private String operatorName;

    @TableField("resource_type")
    private String resourceType;

    @TableField("resource_id")
    private String resourceId;

    private String detail;

    @TableField("ip_address")
    private String ipAddress;
}
