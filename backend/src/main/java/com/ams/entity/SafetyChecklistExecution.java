package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 安全检查表执行记录（SafetyChecklistExecution）
 *
 * <p>业务概念映射：
 * 本实体记录一次安全检查的执行过程，代表用户对某资产执行某个安全检查模板的实例。
 *
 * <p>设计说明：
 * 执行记录包含执行人、执行时间、状态和总体结果等信息。执行记录通过 executionId 关联多个检查结果（SafetyChecklistResult）。
 *
 * <p>字段说明：
 * - id：主键，自增
 * - templateId：执行的模板ID（外键）
 * - assetId：检查的资产ID（外键）
 * - executorId：执行人ID（外键）
 * - executeDate：执行日期
 * - status：执行状态（IN_PROGRESS/COMPLETED/CANCELLED）
 * - overallResult：总体结果（PASS/FAIL/CONDITIONAL）
 * - tenantId：租户ID，用于多租户隔离
 * - createBy：创建人ID
 * - createTime：创建时间（自动填充）
 * - updateTime：更新时间（自动填充）
 * - deleted：逻辑删除标记（0=有效，1=已删除）
 */
@Data
@TableName("safety_checklist_execution")
public class SafetyChecklistExecution {
    @TableId(type = IdType.AUTO)
    private Long id;

    private Long templateId;
    private Long assetId;
    private Long executorId;
    private LocalDate executeDate;
    private String status;
    private String overallResult;

    private String tenantId;
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
