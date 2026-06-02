package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("energy_meter")
public class EnergyMeter implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long assetId;

    private String meterType;

    private BigDecimal readingValue;

    private String unit;

    private LocalDate readingDate;

    private String reader;

    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
