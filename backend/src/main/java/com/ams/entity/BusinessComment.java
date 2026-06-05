package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("business_comment")
public class BusinessComment {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String businessType;
    private Long businessId;
    private Long userId;
    private String userName;
    private String content;
    private Long parentCommentId;
    private Integer likes;

    private String tenantId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;

    /** 非持久化：回复目标用户名（前端展示用） */
    @TableField(exist = false)
    private String replyToUserName;
}
