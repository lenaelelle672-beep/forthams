package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("inventory_detail")
public class InventoryDetail implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long taskId;
    private String tenantId;
    private Long assetId;
    private String rfidTag;
    private String status;
    private String expectedLocation;
    private String actualLocation;
    private LocalDateTime scanTime;
    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
