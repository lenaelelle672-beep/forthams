package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 用户通知偏好实体
 *
 * <p>定义用户对各通知分类的渠道偏好。每个用户在每个分类下有一行配置，
 * 分别控制站内信和邮件两个渠道的开关。支持免打扰时段。</p>
 */
@Data
@TableName("notification_preference")
public class NotificationPreference implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 租户ID */
    private String tenantId;

    /** 用户ID */
    private Long userId;

    /** 通知分类（retirement/maintenance/approval/system） */
    private String category;

    /** 站内信通知（0-关闭 1-开启） */
    private Integer inApp;

    /** 邮件通知（0-关闭 1-开启） */
    private Integer email;

    /** 免打扰开始时间（如 22:00） */
    private String quietStart;

    /** 免打扰结束时间（如 08:00） */
    private String quietEnd;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
