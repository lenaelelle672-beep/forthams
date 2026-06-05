package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("risk_control_measure")
public class RiskControlMeasure {
    @TableId(type = IdType.AUTO)
    private Long id;

    private Long riskAssessmentId;
    private String measureType; // MITIGATION/CONTINGENCY/TRANSFER/ACCEPT
    private String measureDescription;
    private Integer priority; // 1-5, 1 is highest
    private String status; // PENDING/IN_PROGRESS/COMPLETED/CANCELLED
    private Long assignedTo;
    private LocalDate dueDate;
    private LocalDate actualCompletionDate;
    private String effectiveness; // HIGH/MEDIUM/LOW/UNKNOWN
    private String notes;

    private String tenantId;
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}