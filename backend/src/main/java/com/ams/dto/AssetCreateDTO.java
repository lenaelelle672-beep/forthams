package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class AssetCreateDTO {

    @NotBlank(message = "资产编号不能为空")
    private String assetNo;

    @NotBlank(message = "资产名称不能为空")
    private String assetName;

    @NotNull(message = "资产分类不能为空")
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

    @NotBlank(message = "资产状态不能为空")
    private String status;

    @NotNull(message = "所属部门不能为空")
    private Long deptId;
    private Long userId;
    private String location;

    private String rfidTag;
    private Integer isImportant;

    private String description;
    private String remark;

}
