package com.ams.dto;

import com.ams.entity.SystemAlert;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SystemAlertDTO {

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
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    public static SystemAlertDTO from(SystemAlert alert) {
        SystemAlertDTO dto = new SystemAlertDTO();
        dto.setId(alert.getId());
        dto.setTenantId(alert.getTenantId());
        dto.setAlertType(alert.getAlertType());
        dto.setAlertLevel(alert.getAlertLevel());
        dto.setTitle(alert.getTitle());
        dto.setContent(alert.getContent());
        dto.setStatus(alert.getStatus());
        dto.setRead(alert.getRead());
        dto.setReadAt(alert.getReadAt());
        dto.setReadBy(alert.getReadBy());
        dto.setClosedAt(alert.getClosedAt());
        dto.setClosedBy(alert.getClosedBy());
        dto.setCreateTime(alert.getCreateTime());
        dto.setUpdateTime(alert.getUpdateTime());
        return dto;
    }
}
