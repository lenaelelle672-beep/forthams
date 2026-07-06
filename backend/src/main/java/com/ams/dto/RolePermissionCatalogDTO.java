package com.ams.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class RolePermissionCatalogDTO {

    private List<RolePermissionRoleDTO> roles = new ArrayList<>();
    private List<RolePermissionPermissionDTO> permissions = new ArrayList<>();
    private RolePermissionCatalogSummaryDTO summary = new RolePermissionCatalogSummaryDTO();
    private List<String> riskTips = new ArrayList<>();
    private String readonlyNotice;

    @Data
    public static class RolePermissionRoleDTO {
        private Long roleId;
        private String roleName;
        private String roleCode;
        private String description;
        private Integer status;
        private int permissionCount;
        private List<RolePermissionPermissionDTO> permissions = new ArrayList<>();
    }

    @Data
    public static class RolePermissionPermissionDTO {
        private Long permissionId;
        private String permissionName;
        private String permissionCode;
        private String description;
        private Integer status;
    }

    @Data
    public static class RolePermissionCatalogSummaryDTO {
        private int roleCount;
        private int permissionInventoryCount;
        private int rolePermissionBindingCount;
        private int boundPermissionCount;
        private int unboundPermissionCount;
        private int rolesWithoutPermissionsCount;
    }
}
