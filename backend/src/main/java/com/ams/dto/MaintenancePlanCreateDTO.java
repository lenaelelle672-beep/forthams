package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class MaintenancePlanCreateDTO {

    @NotBlank(message = "计划名称不能为空")
    private String planName;

    @NotNull(message = "关联资产不能为空")
    private Long assetId;

    @NotBlank(message = "触发类型不能为空")
    private String triggerType;

    private Integer intervalDays;

    private Integer dayOfWeek;

    private Integer dayOfMonth;

    private Integer monthOfYear;

    @NotNull(message = "开始日期不能为空")
    private LocalDate startDate;

    private LocalDate endDate;

    private BigDecimal estimatedCost;

    private String defaultExecutor;

    private String defaultContent;

    private String priority;

    private String status;

    private Long vendorId;

    private String remark;
}
