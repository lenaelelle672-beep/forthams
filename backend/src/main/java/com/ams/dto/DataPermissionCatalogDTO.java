package com.ams.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 数据权限只读 catalog DTO。
 *
 * 展示每个角色的数据权限范围（dataScope）与风险提示。
 * 列表只读展示；范围变更走 PUT /system/data-permissions/roles/{id}/scope。
 */
@Data
public class DataPermissionCatalogDTO {

    private List<RoleDataScope> roles = new ArrayList<>();
    private CatalogSummary summary = new CatalogSummary();
    private List<String> riskTips = new ArrayList<>();
    private String readOnlyNotice;

    @Data
    public static class RoleDataScope {
        private Long roleId;
        private String roleName;
        private String roleCode;
        /** ALL/DEPT/DEPT_AND_SUB/SELF/CUSTOM */
        private String dataScope;
        private String dataScopeLabel;
        private boolean customScope;
        private List<Long> customDeptIds = new ArrayList<>();
        private int customDeptCount;
        private String riskNote;
    }

    @Data
    public static class CatalogSummary {
        private int roleCount;
        private int allScopeCount;
        private int restrictedScopeCount;
        private int customScopeCount;
    }
}
