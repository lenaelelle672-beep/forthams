package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("asset")
public class Asset implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String assetNo;
    private String assetName;
    private Long categoryId;

    private String model;
    private String brand;
    private String supplier;
    private String serialNo;

    private BigDecimal originalValue;
    private BigDecimal currentValue;
    private LocalDate purchaseDate;
    private Integer warrantyPeriod;
    private BigDecimal depreciationRate;

    private String status;
    private Long deptId;
    private Long userId;
    private Long locationId;
    private String location;

    private String rfidTag;
    private BigDecimal locationLat;
    private BigDecimal locationLng;

    @TableField(exist = false)
    private String locationName;

    private Integer isImportant;

    private String description;
    private String remark;

    private String tenantId;

    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;

}
