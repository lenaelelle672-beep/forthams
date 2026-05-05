package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("inventory_task")
public class InventoryTask implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String taskNo;
    private String taskName;
    private String inventoryType;
    private String tenantId;
    private String status;
    private String deptIds;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer totalCount;
    private Integer scannedCount;
    private Integer matchCount;
    private Integer lossCount;
    private Long executorId;
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
