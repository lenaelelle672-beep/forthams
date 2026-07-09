package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SystemConfigDTO {

    private Long id;
    private String tenantId;
    private String configGroup;
    private String configKey;
    private String configValue;
    private String displayValue;
    private String configName;
    private String configType;
    private Integer status;
    private String remark;
    private Boolean sensitiveMasked;
    private Long lastOperatorId;
    private String lastOperation;
    private String lastOperationReason;
    private String auditEvidenceSummary;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
