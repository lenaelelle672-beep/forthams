package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("maintenance_plan")
public class MaintenancePlan implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;

    private String planName;

    private Long assetId;

    private String triggerType;

    private Integer intervalDays;

    private Integer dayOfWeek;

    private Integer dayOfMonth;

    private Integer monthOfYear;

    private LocalDate startDate;

    private LocalDate endDate;

    private LocalDate lastGeneratedDate;

    private LocalDate nextDueDate;

    private BigDecimal estimatedCost;

    private String defaultExecutor;

    private String defaultContent;

    private String priority;

    private String status;

    private Long vendorId;

    private String remark;

    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
