package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 安全检查表检查项（SafetyChecklistItem）
 *
 * <p>业务概念映射：
 * 本实体定义安全检查表中的具体检查项，每个检查项属于一个模板。
 *
 * <p>设计说明：
 * 检查项定义检查的内容和类型，支持四种类型：
 * - PASS_FAIL：通过/不通过选择
 * - READING：读数（数值）
 * - PHOTO：照片上传
 * - TEXT：文本备注
 *
 * <p>字段说明：
 * - id：主键，自增
 * - templateId：所属模板ID（外键）
 * - itemName：检查项名称
 * - itemType：检查项类型（PASS_FAIL/READING/PHOTO/TEXT）
 * - sortOrder：排序顺序（数字越小越靠前）
 * - required：是否必填（1=必填，0=可选）
 * - createTime：创建时间（自动填充）
 * - updateTime：更新时间（自动填充）
 * - deleted：逻辑删除标记（0=有效，1=已删除）
 */
@Data
@TableName("safety_checklist_item")
public class SafetyChecklistItem {
    @TableId(type = IdType.AUTO)
    private Long id;

    private Long templateId;
    private String itemName;
    private String itemType;
    private Integer sortOrder;
    private Integer required;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
