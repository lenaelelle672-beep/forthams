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
@TableName("sla_config")
public class SlaConfig implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String processKey;
    private String businessType;
    private String nodeKey;
    private String priority;
    private Integer responseHours;
    private Integer resolveHours;
    private Double warningRatio;
    private Double escalationRatio;
    private String notificationTargets;
    private String status;
    private String auditSummary;
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
}
