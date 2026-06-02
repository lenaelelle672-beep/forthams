package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("energy_consumption")
public class EnergyConsumption implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long assetId;

    private String meterType;

    private String periodType;

    private LocalDate periodStart;

    private LocalDate periodEnd;

    private BigDecimal consumption;

    private String unit;

    private BigDecimal cost;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
