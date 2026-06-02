package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 通知模板实体
 *
 * <p>定义通知标题和内容的模板，支持 ${} 变量替换。
 * isBuiltin 标记区分系统内置和用户自定义模板。</p>
 */
@Data
@TableName("notification_template")
public class NotificationTemplate implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 租户ID */
    private String tenantId;

    /** 模板编码 */
    private String templateCode;

    /** 模板名称 */
    private String templateName;

    /** 模板分类（retirement/maintenance/approval/system） */
    private String category;

    /** 默认通知渠道（IN_APP/EMAIL/ALL） */
    private String channelType;

    /** 通知标题模板（支持 ${} 变量） */
    private String titleTemplate;

    /** 通知内容模板（支持 ${} 变量） */
    private String contentTemplate;

    /** 变量定义 JSON */
    private String variables;

    /** 是否内置模板（0-否 1-是） */
    private Integer isBuiltin;

    /** 状态（0-停用 1-启用） */
    private Integer status;

    private String createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    private String updateBy;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
