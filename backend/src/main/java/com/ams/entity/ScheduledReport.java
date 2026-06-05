package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("scheduled_report")
public class ScheduledReport {
    @TableId(type = IdType.AUTO)
    private Long id;

    private Long savedReportId;
    private String cronExpr;
    private String recipientEmails;
    private String format;
    private String status;
    private LocalDateTime lastRunAt;
    private LocalDateTime nextRunAt;
    private String subject;

    private String tenantId;
    private Long createdBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
