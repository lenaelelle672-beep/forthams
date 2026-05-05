package com.ams.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("work_order")
public class WorkOrder {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String workOrderNo;
    private String title;
    private String description;
    private String status;  // DRAFT/PENDING/APPROVED/EXECUTING/COMPLETED/REJECTED/CANCELLED
    private String priority;  // NORMAL/URGENT/EMERGENCY
    private String tenantId;
    private Long assetId;
    private String assetName;
    private String assetCode;
    private Long reporterId;
    private String reporterName;
    private Long assigneeId;
    private String assigneeName;
    private Long deptId;
    private String deptName;
    private LocalDateTime plannedStartDate;
    private LocalDateTime plannedEndDate;
    private LocalDateTime actualStartDate;
    private LocalDateTime actualEndDate;
    private BigDecimal estimatedCost;
    private BigDecimal actualCost;
    private String completionNote;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
    @TableLogic
    private Integer deleted;

    public WorkOrder() { this.status = "DRAFT"; }
}
