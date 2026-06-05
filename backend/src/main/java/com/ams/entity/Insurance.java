package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName("insurance")
public class Insurance {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String policyNo;
    private String insuranceName;
    private String insuranceType;
    private String assetIds;

    @TableField(exist = false)
    private List<Long> assetIdList;

    private String insurer;
    private BigDecimal premium;
    private BigDecimal coverage;
    private BigDecimal deductible;
    private LocalDate startDate;
    private LocalDate endDate;
    private String status;
    private String remark;

    private String tenantId;
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}