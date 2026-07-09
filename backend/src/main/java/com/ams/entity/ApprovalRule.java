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
@TableName("approval_rule")
public class ApprovalRule implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String processKey;
    private String businessType;
    private String nodeKey;
    private String ruleName;
    private Integer priority;
    private String conditionExpression;
    private String conditionSummary;
    private String approverStrategy;
    private String approverSummary;
    private String status;
    private String auditSummary;
    private Long createdBy;
    private Long updatedBy;
    private Long enabledBy;
    private LocalDateTime enabledAt;
    private Long disabledBy;
    private LocalDateTime disabledAt;
    private String disabledReason;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    private Integer deleted;
}
