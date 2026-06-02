package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("asset_usage_log")
public class AssetUsageLog implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long assetId;

    private Long userId;

    private String action;

    private LocalDate usageDate;

    private BigDecimal durationHours;

    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

}
