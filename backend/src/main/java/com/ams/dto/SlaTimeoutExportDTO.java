package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class SlaTimeoutExportDTO {
    private String processKey;
    private String nodeKey;
    private String status;
    private String riskLevel;
    private Long operatorId;
    private Boolean confirmed;
    private String reason;
    private String auditEvidence;
    private Boolean masked;
    private String exportedBy;
    private LocalDateTime exportedAt;
    private String filterSummary;
    private String fieldMaskingPolicy;
    private Integer recordCount;
    private List<SlaTimeoutRecordDTO> records = new ArrayList<>();
    private List<SlaConfigDTO> configs = new ArrayList<>();
    private String contentSummary;
}
