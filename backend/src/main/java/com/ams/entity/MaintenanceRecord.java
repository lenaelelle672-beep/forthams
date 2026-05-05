package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("maintenance_record")
public class MaintenanceRecord implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;
    private Long assetId;
    private String maintenanceType;
    private LocalDate maintenanceDate;
    private LocalDate nextMaintenanceDate;
    private BigDecimal cost;
    private String executor;
    private String content;
    private String result;
    private String remark;
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
