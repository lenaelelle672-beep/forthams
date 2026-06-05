package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 安全检查记录实体 — 记录计划/已分配的安全检查任务
 * 关联模板（templateId）和资产（assetId），由检查员（inspector）在指定日期执行
 */
@Data
@TableName("safety_checklist")
public class SafetyChecklist {
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 关联检查表模板ID */
    private Long templateId;

    /** 关联被检资产ID */
    private Long assetId;

    /** 计划检查日期 */
    private LocalDate checklistDate;

    /** 检查结果：PASS / FAIL / CONDITIONAL / PENDING */
    private String result;

    /** 检查员（执行人）ID */
    private Long inspectorId;

    /** 状态：SCHEDULED / IN_PROGRESS / COMPLETED / OVERDUE */
    private String status;

    /** 租户ID */
    private String tenantId;

    /** 创建人 */
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
