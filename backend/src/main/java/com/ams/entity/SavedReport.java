package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("saved_report")
public class SavedReport {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String reportName;
    private String reportType;
    private String configJson;
    private Integer isPublic;
    private Long createdBy;

    private String tenantId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
