package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("spare_part_usage")
public class SparePartUsage {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long sparePartId;
    private Long workOrderId;
    private BigDecimal quantity;
    private LocalDateTime usageDate;
    private Long userId;
    private String note;
    private String tenantId;
    @TableLogic
    private Integer deleted;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
