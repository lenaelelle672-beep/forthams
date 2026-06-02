package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CustomFieldsetCreateDTO {

    @NotBlank(message = "字段集名称不能为空")
    private String name;

    private String description;
    private Integer status;
}
