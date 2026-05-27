package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class RoleCreateDTO {
    @JsonAlias({"name", "roleName"})
    private String roleName;
    @JsonAlias({"code", "roleCode"})
    private String roleCode;
    private String description;
    private Integer sortOrder;
    private Integer dataScope;
    private Integer menuCheckStrictly;
    private Integer deptCheckStrictly;
}
