package com.ams.dto;

import lombok.Data;

import java.util.Map;

@Data
public class SystemConfigSaveDTO {

    private String tenantId;
    private String configGroup;
    private String configKey;
    private String configValue;
    private String configName;
    private String configType;
    private Integer status;
    private String remark;
    private Long operatorId;
    private String reason;
    private String auditEvidence;
    private Boolean confirmed;
    private Map<String, String> configs;
}
