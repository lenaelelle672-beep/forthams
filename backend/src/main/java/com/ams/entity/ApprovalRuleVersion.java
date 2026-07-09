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
@TableName("approval_rule_version")
public class ApprovalRuleVersion implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long ruleId;
    private Integer versionNo;
    private String actionType;
    private String beforeSnapshot;
    private String afterSnapshot;
    private String auditSummary;
    private Long operatorId;
    private String reason;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
