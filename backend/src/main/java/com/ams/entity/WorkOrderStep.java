package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("work_order_step")
public class WorkOrderStep {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long workOrderId;
    private String stepName;
    private Integer stepOrder;
    private Integer isCompleted;
    private Long completedBy;
    private LocalDateTime completedAt;
    private String note;
    private String tenantId;
    @TableLogic
    private Integer deleted;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
