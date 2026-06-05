package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("asset_revaluation")
public class AssetRevaluation implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;
    private Long assetId;
    private String revaluationType;
    private BigDecimal previousValue;
    private BigDecimal newValue;
    private String reason;
    private String evidence;
    private String status;
    private Long approvedBy;
    private LocalDateTime approvedAt;
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;

    @TableField(exist = false)
    private String assetName;

    @TableField(exist = false)
    private String assetNo;
}
