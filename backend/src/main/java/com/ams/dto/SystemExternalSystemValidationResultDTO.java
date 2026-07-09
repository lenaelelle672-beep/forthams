package com.ams.dto;

import lombok.Data;

@Data
public class SystemExternalSystemValidationResultDTO {

    private Long systemId;
    private String systemCode;
    private Boolean valid;
    private Boolean configOnly;
    private Boolean noRealExternalCall;
    private String targetSummary;
    private String authSummary;
    private String message;
}
