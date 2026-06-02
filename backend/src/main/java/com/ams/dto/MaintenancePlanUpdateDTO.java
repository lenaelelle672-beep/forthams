package com.ams.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class MaintenancePlanUpdateDTO {

    private String planName;

    private Long assetId;

    private String triggerType;

    private Integer intervalDays;

    private Integer dayOfWeek;

    private Integer dayOfMonth;

    private Integer monthOfYear;

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
