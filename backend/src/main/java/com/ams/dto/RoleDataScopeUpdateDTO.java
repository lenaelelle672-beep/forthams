package com.ams.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class RoleDataScopeUpdateDTO {

    @NotBlank
    private String dataScope;

    @Size(max = 100)
    private List<@NotNull @Positive Long> deptIds;
}
