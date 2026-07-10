package com.ams.service;

import com.ams.dto.DataPermissionCatalogDTO;
import com.ams.entity.Role;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 数据权限只读 catalog 服务。
 *
 * 复用 RoleService 读取角色列表，映射每个角色的 dataScope 为可读标签与风险提示。
 * 全部只读：不修改 dataScope（V3 只读边界）。
 *
 * dataScope 语义（只收紧原则）：
 * - ALL：全部数据（最宽，风险提示）
 * - DEPT：本部门
 * - DEPT_AND_SUB：本部门及下属
 * - SELF：仅本人（最严）
 * - CUSTOM：自定义（需配合数据权限规则，跳过投影，风险提示待配置）
 */
@Service
@RequiredArgsConstructor
public class DataPermissionCatalogService {

    private static final String SCOPE_ALL = "ALL";
    private static final String SCOPE_DEPT = "DEPT";
    private static final String SCOPE_DEPT_AND_SUB = "DEPT_AND_SUB";
    private static final String SCOPE_SELF = "SELF";
    private static final String SCOPE_CUSTOM = "CUSTOM";

    private final RoleService roleService;

    public DataPermissionCatalogDTO getCatalog() {
        List<Role> roles = roleService.listAllRoles();

        DataPermissionCatalogDTO catalog = new DataPermissionCatalogDTO();
        List<String> riskTips = new ArrayList<>();
        int allCount = 0;
        int restrictedCount = 0;
        int customCount = 0;

        for (Role role : roles) {
            DataPermissionCatalogDTO.RoleDataScope item = new DataPermissionCatalogDTO.RoleDataScope();
            item.setRoleId(role.getId());
            item.setRoleName(role.getRoleName());
            item.setRoleCode(role.getRoleCode());
            String scope = normalizeScope(role.getDataScope());
            item.setDataScope(scope);
            item.setDataScopeLabel(labelFor(scope));
            item.setCustomScope(SCOPE_CUSTOM.equals(scope));
            item.setRiskNote(riskNoteFor(scope, role.getRoleName()));

            if (SCOPE_ALL.equals(scope)) {
                allCount++;
            } else if (SCOPE_CUSTOM.equals(scope)) {
                customCount++;
            } else {
                restrictedCount++;
            }
            catalog.getRoles().add(item);
        }

        DataPermissionCatalogDTO.CatalogSummary summary = catalog.getSummary();
        summary.setRoleCount(roles.size());
        summary.setAllScopeCount(allCount);
        summary.setRestrictedScopeCount(restrictedCount);
        summary.setCustomScopeCount(customCount);

        if (allCount > 0) {
            riskTips.add("有 " + allCount + " 个角色持有 ALL（全部数据）范围，建议按最小权限原则收紧。");
        }
        if (customCount > 0) {
            riskTips.add("有 " + customCount + " 个角色为 CUSTOM 范围，需配合数据权限规则并校验部门配置，CUSTOM 跳过投影。");
        }
        catalog.setRiskTips(riskTips);
        catalog.setReadOnlyNotice("数据权限为只读 catalog；修改 dataScope 与配置 CUSTOM 规则不在 V3 只读边界内，需后续权限专项处理。");
        return catalog;
    }

    private String normalizeScope(String raw) {
        String value = raw == null ? "" : raw.trim().toUpperCase();
        if (value.isEmpty()) {
            return SCOPE_ALL;
        }
        return switch (value) {
            case SCOPE_ALL, SCOPE_DEPT, SCOPE_DEPT_AND_SUB, SCOPE_SELF, SCOPE_CUSTOM -> value;
            default -> SCOPE_ALL;
        };
    }

    private String labelFor(String scope) {
        return switch (scope) {
            case SCOPE_DEPT -> "本部门";
            case SCOPE_DEPT_AND_SUB -> "本部门及下属";
            case SCOPE_SELF -> "仅本人";
            case SCOPE_CUSTOM -> "自定义";
            default -> "全部数据";
        };
    }

    private String riskNoteFor(String scope, String roleName) {
        return switch (scope) {
            case SCOPE_ALL -> roleName + " 可见全部数据，范围最宽。";
            case SCOPE_CUSTOM -> roleName + " 为自定义范围，需配合数据权限规则。";
            case SCOPE_SELF -> roleName + " 仅可见本人数据，范围最严。";
            default -> "";
        };
    }
}
