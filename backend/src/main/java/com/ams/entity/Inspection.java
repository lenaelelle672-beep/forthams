package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("inspection")
public class Inspection {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String inspectionNo;
    private Long assetId;
    private String inspectionType;
    private LocalDate inspectionDate;
    private LocalDate nextInspectionDate;
    private String inspectionAgency;
    private String inspectorName;
    private String result;
    private String certificateNo;
    private LocalDate certificateExpiry;
    private String reportAttachment;
    private BigDecimal cost;
    private Long templateId;
    private String photos;
    private String findings;

    private String tenantId;
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
