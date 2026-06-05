package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 安全检查表模板（SafetyChecklistTemplate）
 *
 * <p>业务概念映射：
 * 本实体对应业务概念中的"安全检查表模板"（SafetyChecklist Template），定义安全检查表的结构和检查项。
 *
 * <p>设计说明：
 * 采用分离式设计（Template-Item-Execution-Result），本实体仅负责模板定义，包含模板名称、关联的分类ID、状态等信息。
 * 模板通过 ID 关联多个检查项（SafetyChecklistItem），执行记录（SafetyChecklistExecution）引用模板 ID 来关联模板。
 *
 * <p>字段说明：
 * - id：主键，自增
 * - templateName：模板名称
 * - categoryIds：关联的分类ID列表（逗号分隔）
 * - tenantId：租户ID，用于多租户隔离
 * - status：状态（ACTIVE/INACTIVE）
 * - createBy：创建人ID
 * - createTime：创建时间（自动填充）
 * - updateTime：更新时间（自动填充）
 * - deleted：逻辑删除标记（0=有效，1=已删除）
 */
@Data
@TableName("safety_checklist_template")
public class SafetyChecklistTemplate {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String templateName;
    private String categoryIds;
    private String tenantId;
    private String status;

    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
