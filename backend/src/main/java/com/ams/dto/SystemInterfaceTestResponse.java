package com.ams.dto;

import lombok.Data;

@Data
public class SystemInterfaceTestResponse {

    private Long interfaceId;
    private Boolean valid;
    private Boolean configOnly;
    private String target;
    private String message;
}
