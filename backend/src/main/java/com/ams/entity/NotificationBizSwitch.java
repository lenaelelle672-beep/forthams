package com.ams.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 流程通知开关实体
 *
 * <p>控制各业务流程中哪些事件触发通知，以及使用哪个模板。
 * 管理员可在后台开启/关闭特定业务事件的通知。</p>
 */
@Data
@TableName("notification_biz_switch")
public class NotificationBizSwitch implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 业务类型（如 retirement、maintenance） */
    private String bizType;

    /** 事件（如 submitted、approved、rejected、reminder） */
    private String event;

    /** 是否启用（0-关闭 1-开启） */
    private Integer enabled;

    /** 关联通知模板编码 */
    private String templateCode;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
