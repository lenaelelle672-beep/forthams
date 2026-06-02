package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("sam_compliance_detail")
public class SamComplianceDetail {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long scanId;
    private Long licenseId;
    private String softwareName;
    private String licenseType;
    private Integer totalSeats;
    private Integer usedSeats;
    private String complianceStatus;
    private String riskLevel;
    private String recommendation;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
