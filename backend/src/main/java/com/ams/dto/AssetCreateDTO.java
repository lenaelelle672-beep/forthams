package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class AssetCreateDTO {
    @JsonAlias({"code", "assetNo"})
    private String assetNo;
    @JsonAlias({"name", "assetName"})
    private String assetName;
    @JsonAlias({"category", "categoryId"})
    private Long categoryId;
    private String model;
    private String brand;
    private String supplier;
    private String serialNo;
    @JsonAlias({"value", "originalValue"})
    private BigDecimal originalValue;
    private BigDecimal currentValue;
    private LocalDate purchaseDate;
    private Integer warrantyPeriod;
    private BigDecimal depreciationRate;
    private String status;
    @JsonAlias({"department", "deptId"})
    private Long deptId;
    @JsonAlias({"user", "userId"})
    private Long userId;
    private String location;
    private String rfidTag;
    private Integer isImportant;
    private String description;
    private String remark;
}
