package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("floor_plan_asset")
public class FloorPlanAsset implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long planId;
    private Long assetId;
    private BigDecimal posX;
    private BigDecimal posY;
    private String label;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
