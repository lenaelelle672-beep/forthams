package com.ams.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("sys_channel_config")
public class ChannelConfig {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("channel_type")
    private String channelType;

    @TableField("config_name")
    private String configName;

    @TableField("webhook_url")
    private String webhookUrl;

    private String secret;

    private Integer enabled;

    private String description;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;
}
