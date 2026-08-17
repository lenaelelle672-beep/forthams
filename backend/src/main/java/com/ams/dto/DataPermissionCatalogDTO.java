package com.ams.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * 数据权限只读 catalog DTO。
 *
 * 展示每个角色的数据权限范围（dataScope）与风险提示。
 * 只读：不提供修改 dataScope 的写操作（V3 只读边界）。
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
        /** ALL/DEPT/DEPT_AND_SUB/SELF/CUSTOM；DENY 仅表示无效或缺失规则的默认拒绝状态。 */
        private String dataScope;
        private String dataScopeLabel;
        private boolean customScope;
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
