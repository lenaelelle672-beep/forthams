package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class MaintenanceCreateDTO {

    @NotNull(message = "资产ID不能为空")
    private Long assetId;

    @NotBlank(message = "维护类型不能为空")
    private String maintenanceType;

    @NotNull(message = "维护日期不能为空")
    private LocalDate maintenanceDate;

    private LocalDate nextMaintenanceDate;
    private BigDecimal cost;
    private String executor;
    private String content;
    private String result;
    private String remark;
}
