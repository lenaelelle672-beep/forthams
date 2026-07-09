package com.ams.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class SystemConfigPreviewDTO {

    private String configGroup;
    private List<String> changedKeys;
    private Map<String, String> beforeMasked;
    private Map<String, String> afterMasked;
    private List<String> impactModules;
    private String riskLevel;
    private List<String> validationErrors;
    private Boolean persistent;
    private Boolean cacheRefreshed;
    private Boolean runtimeEffect;
    private String summary;
}
