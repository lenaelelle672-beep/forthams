package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("tco_record")
public class TCORecord implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;
    private Long assetId;
    private LocalDate calculationDate;
    private Integer periodYear;
    private Integer periodMonth;
    private BigDecimal totalCost;
    private BigDecimal purchaseCost;
    private BigDecimal maintenanceCost;
    private BigDecimal workOrderCost;
    private BigDecimal energyCost;
    private BigDecimal insuranceCost;
    private BigDecimal currentValue;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
