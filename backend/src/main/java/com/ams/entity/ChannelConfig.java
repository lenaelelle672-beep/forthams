package com.ams.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("channel_config")
public class ChannelConfig {
    private Long id;
    private String tenantId;
    private String channelType;
    private String configName;
    private String webhookUrlMasked;
    private Boolean webhookUrlConfigured;
    private Boolean signatureConfigured;
    private Integer enabled;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
