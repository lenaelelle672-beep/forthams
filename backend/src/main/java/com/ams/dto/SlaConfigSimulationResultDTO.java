package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
public class SlaConfigSimulationResultDTO {
    private String processKey;
    private String businessType;
    private String nodeKey;
    private String priority;
    private Long matchedConfigId;
    private String policySummary;
    private Integer responseHours;
    private Integer resolveHours;
    private LocalDateTime responseDueAt;
    private LocalDateTime resolveDueAt;
    private LocalDateTime warningAt;
    private LocalDateTime escalationAt;
    private Long remainingMinutes;
    private List<String> reminders = new ArrayList<>();
    private List<String> escalationSuggestions = new ArrayList<>();
    private List<Map<String, String>> notificationTargets = new ArrayList<>();
    private String variablePreviewMasked;
    private String safeExplanation;
    private String auditSummary;
    private Boolean tenantScoped;
    private LocalDateTime simulatedAt;
    private List<String> warnings = new ArrayList<>();
}
