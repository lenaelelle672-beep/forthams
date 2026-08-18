package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DataPermissionScopeUpdateDTO {
    @NotBlank
    private String dataScope;
}
