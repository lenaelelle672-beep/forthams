package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 安全检查表检查结果（SafetyChecklistResult）
 *
 * <p>业务概念映射：
 * 本实体记录每个检查项的结果，包含通过/不通过结果、读数、照片和备注等信息。
 *
 * <p>设计说明：
 * 检查结果关联到执行记录（executionId）和检查项（itemId），一个执行记录包含多个检查结果（每个检查项一个结果）。
 * 照片通过附件机制（SysAttachment）存储，business_type='SAFETY_CHECKLIST_RESULT'，businessId=result.id。
 *
 * <p>字段说明：
 * - id：主键，自增
 * - executionId：执行记录ID（外键）
 * - itemId：检查项ID（外键）
 * - result：检查结果（PASS/FAIL/NA）
 * - reading：读数（数值，仅当 itemType=READING 时使用）
 * - photoUrl：照片URL（废弃，照片通过 SysAttachment 机制管理）
 * - note：备注（文本，仅当 itemType=TEXT 时使用）
 * - createTime：创建时间（自动填充）
 * - updateTime：更新时间（自动填充）
 * - deleted：逻辑删除标记（0=有效，1=已删除）
 */
@Data
@TableName("safety_checklist_result")
public class SafetyChecklistResult {
    @TableId(type = IdType.AUTO)
    private Long id;

    private Long executionId;
    private Long itemId;
    private String result;
    private BigDecimal reading;
    private String photoUrl;
    private String note;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
