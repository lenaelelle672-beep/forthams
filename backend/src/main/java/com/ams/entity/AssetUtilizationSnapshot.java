package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("asset_utilization_snapshot")
public class AssetUtilizationSnapshot implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long assetId;

    private String periodType;

    private LocalDate periodStart;

    private LocalDate periodEnd;

    private BigDecimal totalHours;

    private BigDecimal usedHours;

    private BigDecimal utilizationRate;

    private BigDecimal idleHours;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

}
