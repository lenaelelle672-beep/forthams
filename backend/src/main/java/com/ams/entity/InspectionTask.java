package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 检验任务实体
 * 用于管理检验任务的创建、执行和跟踪
 */
@Data
@TableName("inspection_task")
public class InspectionTask {
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 任务编号（唯一）
     */
    private String taskNo;

    /**
     * 检验模板ID
     */
    private Long templateId;

    /**
     * 任务名称
     */
    private String taskName;

    /**
     * 任务类型：ANNUAL/PERIODIC/SPECIAL
     */
    private String taskType;

    /**
     * 计划检验日期
     */
    private LocalDate plannedDate;

    /**
     * 实际检验日期
     */
    private LocalDate actualDate;

    /**
     * 任务状态：PENDING/IN_PROGRESS/COMPLETED/CANCELLED/OVERDUE
     */
    private String status;

    /**
     * 分配给（用户ID）
     */
    private Long assignedTo;

    /**
     * 备注
     */
    private String remarks;

    /**
     * 租户ID
     */
    private String tenantId;

    /**
     * 创建人ID
     */
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}