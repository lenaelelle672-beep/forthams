package com.ams.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 入库资产 DTO — 验收通过后用于创建 Asset 卡片。
 */
@Data
public class IntakeAssetDTO {
    private String assetNo;
    private String assetName;
    private String model;
    private String brand;
    private String serialNo;
    private String supplier;
    private LocalDate purchaseDate;
    private BigDecimal originalValue;
    private Integer warrantyPeriod;
    private Long categoryId;
    private Long locationId;
    private String remark;
}
