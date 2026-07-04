package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SystemIntegrationInterfaceResponse {

    private Long id;
    private String tenantId;
    private Long externalSystemId;
    private String interfaceName;
    private String method;
    private String path;
    private String requestSchema;
    private String responseSchema;
    private Boolean enabled;
    private String status;
    private Boolean configMasked;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
