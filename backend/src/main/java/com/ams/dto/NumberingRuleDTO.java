package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NumberingRuleDTO {
    private Long id;
    private String tenantId;
    private String ruleKey;
    private String name;
    private String template;
    private String source;
    private String authority;
    private Boolean defaultRule;
    private Boolean tenantScoped;
    private Boolean readOnly;
    private String readonlyBoundary;
    private List<String> variables;
    private LocalDateTime updateTime;
}
