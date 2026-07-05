package com.ams.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("system_alert")
public class SystemAlert implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId;
    private String alertType;
    private String alertLevel;
    private String title;
    private String content;
    private String status;
    private Boolean read;
    private LocalDateTime readAt;
    private Long readBy;
    private LocalDateTime closedAt;
    private Long closedBy;
    private Long createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
