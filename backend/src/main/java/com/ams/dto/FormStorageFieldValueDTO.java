package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class FormStorageFieldValueDTO {
    private Long id;
    private String fieldKey;
    private String fieldLabel;
    private String valueType;
    private Object rawValue;
    private Boolean sensitive;
    private String maskedValue;
    private String maskedSummary;
}
