package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class RoleCreateDTO {
    @JsonAlias({"name", "roleName"})
    @NotBlank
    @Size(max = 64)
    private String roleName;
    @JsonAlias({"code", "roleCode"})
    @NotBlank
    @Size(min = 2, max = 64)
    @Pattern(regexp = "^[A-Za-z0-9_]+$")
    private String roleCode;
    private String description;
}
