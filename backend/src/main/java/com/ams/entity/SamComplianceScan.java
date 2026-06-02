package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("sam_compliance_scan")
public class SamComplianceScan {
    @TableId(type = IdType.AUTO)
    private Long id;
    private LocalDateTime scanDate;
    private Integer totalLicenses;
    private Integer compliantCount;
    private Integer overusedCount;
    private Integer underusedCount;
    private Integer expiredCount;
    private BigDecimal complianceRate;
    private String status;
    private String reportUrl;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
