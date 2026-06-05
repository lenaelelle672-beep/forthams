package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName("asset")
public class Asset implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String assetNo;
    private String assetName;
    private Long categoryId;

    /** ABC分类: A-高价值, B-中价值, C-低价值 */
    private String abcClassification;

    private String model;
    private String brand;
    private String supplier;
    private String serialNo;

    private BigDecimal originalValue;
    private BigDecimal currentValue;
    private LocalDate purchaseDate;
    private Integer warrantyPeriod;
    private BigDecimal depreciationRate;

    /** 采购成本（TCO初始成本项） */
    private BigDecimal purchaseCost;

    /** 折旧方法: STRAIGHT_LINE/DOUBLE_DECLINING/SYD/UOP */
    private String depreciationMethod;

    /** 总预期工作量（UOP工作量法） */
    private BigDecimal totalExpectedUnits;

    /** 实际已工作量（UOP工作量法） */
    private BigDecimal actualUnits;

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

    /** 父子关系 — 子资产列表（仅查询时使用） */
    @TableField(exist = false)
    private List<Asset> children;

    /** 父资产名称（仅查询时使用） */
    @TableField(exist = false)
    private String parentName;

    /** 父资产编号（仅查询时使用） */
    @TableField(exist = false)
    private String parentAssetNo;

    /** 关系类型（仅查询时使用） */
    @TableField(exist = false)
    private String relationType;

    private String tenantId;

    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;

}
