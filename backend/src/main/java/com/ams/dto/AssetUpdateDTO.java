package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@JsonIgnoreProperties({
        "deptId", "userId", "location", "locationId",
        "department", "user", "dept_id", "user_id", "location_id"
})
public class AssetUpdateDTO {
    @JsonAlias({"name", "assetName"})
    @NotBlank
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
    private BigDecimal locationLat;
    private BigDecimal locationLng;
    private String rfidTag;
    private Integer isImportant;
    private String description;
    private String remark;
}
