package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 验收检查项实体。
 * <p>对应表 intake_check_item，逐项记录验收结果。</p>
 */
@Data
@TableName("intake_check_item")
public class IntakeCheckItem implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 验收单 ID */
    private Long intakeOrderId;

    /** 检查项名称 */
    private String itemName;

    /** 预期值 */
    private String expectedValue;

    /** 实际值 */
    private String actualValue;

    /** 检查结果: PENDING/PASS/FAIL */
    private String result;

    /** 备注 */
    private String remark;

    /** 排序 */
    private Integer sortOrder;

    /** 租户 ID */
    private String tenantId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
