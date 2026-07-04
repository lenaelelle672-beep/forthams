package com.ams.dto;

import lombok.Data;

@Data
public class SystemIntegrationInterfaceRequest {

    private Long externalSystemId;
    private String interfaceName;
    private String method;
    private String path;
    private String requestSchema;
    private String responseSchema;
    private Boolean enabled;
}
