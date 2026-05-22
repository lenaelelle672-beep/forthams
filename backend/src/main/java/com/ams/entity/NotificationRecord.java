package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 通知记录实体类
 *
 * <p>存储用户站内通知，支持审批、维保、盘点、系统公告等多种类型。
 * 每条通知关联一个用户，可标记已读/未读，可选关联业务对象。</p>
 */
@Data
@TableName("notification")
public class NotificationRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("user_id")
    private Long userId;

    private String title;

    private String content;

    private String type;

    private String category;

    @TableField("is_read")
    private Integer isRead;

    @TableField("ref_id")
    private Long refId;

    @TableField("ref_type")
    private String refType;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("read_at")
    private LocalDateTime readAt;
}
