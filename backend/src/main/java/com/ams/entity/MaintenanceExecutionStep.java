package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 施工步骤记录实体。
 *
 * <p>记录维保施工过程中的具体操作步骤，包括步骤名称、排序、操作人、工时等。
 * 每个步骤关联到维保执行主记录（MaintenanceExecution）。
 *
 * <p>与 WorkOrderStep（工单检查清单步骤）职责不同：
 * MaintenanceExecutionStep 用于维保施工过程的详细步骤跟踪；
 * WorkOrderStep 用于工单执行前的检查清单确认。两者共存但不冲突。
 */
@Data
@TableName("maintenance_execution_step")
public class MaintenanceExecutionStep implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;
    private Long executionId;
    private String stepName;
    private Integer stepOrder;
    private String description;
    private Long operatorId;
    private String operatorName;
    private BigDecimal laborHours;
    private LocalDateTime startTime;
    private LocalDateTime endTime;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
