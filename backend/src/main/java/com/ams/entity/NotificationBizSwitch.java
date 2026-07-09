package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("notification_switch")
public class NotificationBizSwitch {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String bizType;
    private String event;
    private String channelType;
    private Integer enabled;
    private String templateCode;
    private String description;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
