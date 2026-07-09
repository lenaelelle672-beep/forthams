package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NumberingRulePreviewRespDTO {
    private String ruleKey;
    private String template;
    private String previewValue;
    private List<String> usedVariables;
    private List<String> missingVariables;
    private List<String> rejectedVariables;
    private String authority;
    private List<String> warnings;
    private Boolean tenantScoped;
    private Boolean noPersistence;
    private Boolean noSequenceReserved;
    private Boolean runtimeEffect;
    private Boolean cacheRefreshed;
    private Boolean sequenceAllocated;
    private Boolean persistent;
    private String readonlyBoundary;
}
