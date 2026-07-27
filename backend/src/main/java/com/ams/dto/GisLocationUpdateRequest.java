package com.ams.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class GisLocationUpdateRequest {

    @NotNull(message = "纬度不能为空")
    @DecimalMin(value = "-90.0", message = "纬度必须在 -90 到 90 之间")
    @DecimalMax(value = "90.0", message = "纬度必须在 -90 到 90 之间")
    private BigDecimal lat;

    @NotNull(message = "经度不能为空")
    @DecimalMin(value = "-180.0", message = "经度必须在 -180 到 180 之间")
    @DecimalMax(value = "180.0", message = "经度必须在 -180 到 180 之间")
    private BigDecimal lng;
}
