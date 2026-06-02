package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CustomFieldUpdateDTO {

    @NotBlank(message = "字段名不能为空")
    private String fieldName;

    @NotBlank(message = "显示名不能为空")
    private String fieldLabel;

    @NotBlank(message = "字段类型不能为空")
    private String fieldType;

    private String fieldOptions;
    private String validationPattern;
    private Integer fieldOrder;
    private Integer required;
    private Integer encrypted;
    private Integer status;
}
