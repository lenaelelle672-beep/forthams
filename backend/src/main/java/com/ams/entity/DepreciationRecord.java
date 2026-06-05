package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("depreciation_record")
public class DepreciationRecord implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;
    private Long assetId;
    private String method;
    private LocalDate periodStart;
    private LocalDate periodEnd;
    private BigDecimal depreciationAmount;
    private BigDecimal bookValueBefore;
    private BigDecimal bookValueAfter;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;

    @TableField(exist = false)
    private String assetNo;

    @TableField(exist = false)
    private String assetName;
}
