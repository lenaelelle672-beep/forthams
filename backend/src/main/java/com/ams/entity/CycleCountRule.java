package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("cycle_count_rule")
public class CycleCountRule {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String classification;
    private String frequency;
    private String categoryIds;
    private BigDecimal minValue;
    private BigDecimal maxValue;

    private String tenantId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
