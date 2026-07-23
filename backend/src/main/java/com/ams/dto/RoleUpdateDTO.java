package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class RoleUpdateDTO {
    @JsonAlias({"name", "roleName"})
    @NotBlank
    @Size(max = 64)
    private String roleName;
    private String description;
}
