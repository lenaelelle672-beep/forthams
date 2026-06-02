package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("software_license")
public class SoftwareLicense {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String licenseName;
    private String licenseKey;
    private String softwareType;
    private String manufacturer;
    private String version;
    private String licenseType;
    private Integer totalSeats;
    private LocalDate purchaseDate;
    private LocalDate expiryDate;
    private BigDecimal purchasePrice;
    private String purchaseOrderNo;
    private String status;
    private String fileUrl;
    private String remark;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
    @TableLogic
    private Integer deleted;
}
