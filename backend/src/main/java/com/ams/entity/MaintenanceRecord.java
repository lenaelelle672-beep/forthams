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
    /** 关联工单ID（可为空，兼容存量数据） */
    private Long workOrderId;
    private String maintenanceType;
    /** 来源: MANUAL/PLAN（计划生成或手动创建） */
    private String sourceType;
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
