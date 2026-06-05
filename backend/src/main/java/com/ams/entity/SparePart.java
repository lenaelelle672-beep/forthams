package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("spare_part")
public class SparePart {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String partNo;
    private String partName;
    private String specification;
    private Long categoryId;
    private BigDecimal currentStock;
    private BigDecimal safetyStock;
    private String unit;
    private BigDecimal unitPrice;
    private Long locationId;
    private Long vendorId;
    private String status;
    private String tenantId;
    @Version
    private Integer version;
    @TableLogic
    private Integer deleted;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
