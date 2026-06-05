package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 入库资产（临时表）实体。
 * <p>对应表 intake_asset，验收通过后自动转为正式 Asset 卡片。</p>
 */
@Data
@TableName("intake_asset")
public class IntakeAsset implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 验收单 ID */
    private Long intakeOrderId;

    /** 资产编号 */
    private String assetNo;

    /** 资产名称 */
    private String assetName;

    /** 规格型号 */
    private String model;

    /** 品牌 */
    private String brand;

    /** 序列号 */
    private String serialNo;

    /** 供应商 */
    private String supplier;

    /** 购置日期 */
    private LocalDate purchaseDate;

    /** 原值 */
    private BigDecimal originalValue;

    /** 保修期(月) */
    private Integer warrantyPeriod;

    /** 分类 ID */
    private Long categoryId;

    /** 存放地点 ID */
    private Long locationId;

    /** 备注 */
    private String remark;

    /** 租户 ID */
    private String tenantId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
