package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("insurance_claim")
public class InsuranceClaim {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String claimNo;
    private Long insuranceId;
    private LocalDate claimDate;
    private String incidentDescription;
    private BigDecimal claimAmount;
    private BigDecimal settledAmount;
    private String status;
    private LocalDate settleDate;
    private String remark;

    @TableField(exist = false)
    private String policyNo;

    @TableField(exist = false)
    private String insuranceName;

    private String tenantId;
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}