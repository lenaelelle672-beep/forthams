package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class RoleUpdateDTO {
    @JsonAlias({"name", "roleName"})
    private String roleName;
    private String description;
}
