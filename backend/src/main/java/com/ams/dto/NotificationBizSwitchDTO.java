package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationBizSwitchDTO {
    private Long id;
    private String tenantId;
    private String bizType;
    private String event;
    private String channelType;
    private Integer enabled;
    private String templateCode;
    private String description;
    private Boolean tenantScoped;
    private String readonlyBoundary;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
