package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("license_assignment")
public class LicenseAssignment {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long licenseId;
    private Long assetId;
    private Long userId;
    private LocalDate assignedDate;
    private LocalDate returnedDate;
    private String notes;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
