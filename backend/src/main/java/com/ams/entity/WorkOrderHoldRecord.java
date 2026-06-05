package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("work_order_hold_record")
public class WorkOrderHoldRecord {
    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("work_order_id")
    private Long workOrderId;

    @TableField("hold_reason")
    private String holdReason;

    @TableField("held_by")
    private Long heldBy;

    @TableField("held_at")
    private LocalDateTime heldAt;

    @TableField("hold_end_time")
    private LocalDateTime holdEndTime;

    @TableField("resumed_by")
    private Long resumedBy;

    @TableField("resumed_at")
    private LocalDateTime resumedAt;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("last_notification_time")
    private LocalDateTime lastNotificationTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;

    @TableField(value = "create_time", fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(value = "update_time", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
