package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 维保执行主记录实体。
 *
 * <p>维护施工执行生命周期（IDLE→RUNNING→PAUSED→RUNNING→COMPLETED），
 * 关联维保记录（maintenance_record）和工单（work_order）。
 *
 * <p>职责边界：本实体用于维保粒度的施工过程跟踪，
 * 与工单粒度步骤实体 WorkOrderStep 职责不同——前者记录维保施工步骤，
 * 后者记录工单内的检查清单步骤，两者共存但不冲突。
 */
@Data
@TableName("maintenance_execution")
public class MaintenanceExecution implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;
    private Long maintenanceRecordId;
    private Long workOrderId;
    private Long assigneeId;
    private String assigneeName;

    /** 状态: IDLE/RUNNING/PAUSED/COMPLETED */
    private String status;

    private BigDecimal totalLaborHours;
    private BigDecimal totalMaterialCost;
    private LocalDateTime startTime;
    private LocalDateTime pauseTime;
    private LocalDateTime resumeTime;
    private LocalDateTime endTime;
    private String remark;
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
