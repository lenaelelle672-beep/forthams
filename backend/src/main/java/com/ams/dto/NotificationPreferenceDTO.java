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
public class NotificationPreferenceDTO {
    private Long id;
    private String tenantId;
    private String category;
    private String categoryLabel;
    private Integer inApp;
    private Integer email;
    private String quietStart;
    private String quietEnd;
    private Integer status;
    private Boolean missingPreference;
    private Boolean tenantScoped;
    private String readonlyBoundary;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
