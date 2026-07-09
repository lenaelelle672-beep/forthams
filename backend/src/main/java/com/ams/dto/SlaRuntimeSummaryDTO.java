package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Data
public class SlaRuntimeSummaryDTO {
    private Integer totalConfigs;
    private Integer activeConfigs;
    private Integer overdueCount;
    private Integer warningCount;
    private Integer criticalCount;
    private Integer timeoutRecordCount;
    private Map<String, Integer> riskCounts = new LinkedHashMap<>();
    private List<String> nodeDurationSummary = new ArrayList<>();
    private List<String> abnormalTraceSummary = new ArrayList<>();
    private List<SlaTimeoutRecordDTO> recentTimeoutRecords = new ArrayList<>();
    private String exportMaskingNotice;
    private Boolean readOnly;
    private Boolean tenantScoped;
    private LocalDateTime generatedAt;
}
