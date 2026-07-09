package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
public class SlaConfigSimulationDTO {
    private String processKey;
    private String businessType;
    private String nodeKey;
    private String priority;
    private LocalDateTime processStartedAt;
    private LocalDateTime taskArrivedAt;
    private LocalDateTime nodeStartedAt;
    private Map<String, Object> variables;
    private Long operatorId;
    private Boolean confirmed;
    private String reason;
    private String auditEvidence;
}
