package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class AssetUpdateDTO {
    @Size(max = 100, message = "资产名称长度不能超过100")
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

    @Size(max = 500, message = "描述长度不能超过500")
    private String description;

    @Size(max = 200, message = "备注长度不能超过200")
    private String remark;
}
