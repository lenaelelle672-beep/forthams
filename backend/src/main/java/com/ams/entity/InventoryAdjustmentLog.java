package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("inventory_adjustment_log")
public class InventoryAdjustmentLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long taskId;
    private Long detailId;
    private Long assetId;
    private String assetNo;
    private String assetName;
    private String adjustmentType;
    private String statusBefore;
    private String statusAfter;
    private String remark;
    private Long createdBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
