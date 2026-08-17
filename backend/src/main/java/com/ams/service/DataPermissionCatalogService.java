package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.dto.DataPermissionCatalogDTO;
import com.ams.entity.Dept;
import com.ams.entity.Role;
import com.ams.entity.RoleDataScopeRule;
import com.ams.entity.RoleDept;
import com.ams.enums.DataScope;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.RoleDataScopeMapper;
import com.ams.mapper.RoleDeptMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 数据权限只读 catalog 服务。
 *
 * 复用 RoleService 与 tenant-scoped 规则读取角色列表，映射每个角色的 dataScope 为可读标签与风险提示。
 * 全部只读：不修改数据权限规则。
 *
 * dataScope 语义（只收紧原则）：
 * - ALL：全部数据（最宽，风险提示）
 * - DEPT：本部门
 * - DEPT_AND_SUB：本部门及下属
 * - SELF：仅本人（最严）
 * - CUSTOM：自定义（仅来自显式角色-部门关联）
 * - 空、未知、重复或缺失规则：默认拒绝
 */
@Service
@RequiredArgsConstructor
public class DataPermissionCatalogService {

    private static final String SCOPE_ALL = "ALL";
    private static final String SCOPE_DEPT = "DEPT";
    private static final String SCOPE_DEPT_AND_SUB = "DEPT_AND_SUB";
    private static final String SCOPE_SELF = "SELF";
    private static final String SCOPE_CUSTOM = "CUSTOM";
    private static final String SCOPE_DENY = "DENY";

    private final RoleService roleService;
    private final RoleDataScopeMapper roleDataScopeMapper;
    private final RoleDeptMapper roleDeptMapper;
    private final DeptMapper deptMapper;

    public DataPermissionCatalogDTO getCatalog() {
        String tenantId = TenantContext.requireTenantId();
        List<Role> roles = roleService.listAllRoles();
        Map<Long, String> scopesByRoleId = scopesByRoleId(tenantId);
        Set<Long> invalidCustomRoleIds = invalidCustomRoleIds(tenantId, scopesByRoleId);

        DataPermissionCatalogDTO catalog = new DataPermissionCatalogDTO();
        List<String> riskTips = new ArrayList<>();
        int allCount = 0;
        int restrictedCount = 0;
        int customCount = 0;
        int denyCount = 0;

        for (Role role : roles) {
            DataPermissionCatalogDTO.RoleDataScope item = new DataPermissionCatalogDTO.RoleDataScope();
            item.setRoleId(role.getId());
            item.setRoleName(role.getRoleName());
            item.setRoleCode(role.getRoleCode());
            String scope = normalizeScope(scopesByRoleId.get(role.getId()));
            if (SCOPE_CUSTOM.equals(scope) && invalidCustomRoleIds.contains(role.getId())) {
                scope = SCOPE_DENY;
            }
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
                if (SCOPE_DENY.equals(scope)) {
                    denyCount++;
                }
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
            riskTips.add("有 " + customCount + " 个角色为 CUSTOM 范围，仅显式角色-部门关联会参与授权。");
        }
        if (denyCount > 0) {
            riskTips.add("有 " + denyCount + " 个角色的数据权限规则为空、未知或重复，实际访问已默认拒绝。");
        }
        catalog.setRiskTips(riskTips);
        catalog.setReadOnlyNotice("数据权限目录为只读；仅 tenant-scoped 规则与显式角色-部门关联参与资产列表强制执行，空值、未知值和缺失规则均默认拒绝。");
        return catalog;
    }

    private Map<Long, String> scopesByRoleId(String tenantId) {
        Map<Long, String> scopesByRoleId = new HashMap<>();
        Set<Long> duplicateRoleIds = new HashSet<>();
        List<RoleDataScopeRule> rules = roleDataScopeMapper.selectByTenantId(tenantId);
        if (rules == null) {
            return scopesByRoleId;
        }
        for (RoleDataScopeRule rule : rules) {
            if (rule == null || rule.getRoleId() == null || !tenantId.equals(rule.getTenantId())) {
                continue;
            }
            if (scopesByRoleId.containsKey(rule.getRoleId())) {
                duplicateRoleIds.add(rule.getRoleId());
                continue;
            }
            scopesByRoleId.put(rule.getRoleId(), rule.getDataScope());
        }
        duplicateRoleIds.forEach(scopesByRoleId::remove);
        return scopesByRoleId;
    }

    private String normalizeScope(String raw) {
        return DataScope.fromValue(raw).map(DataScope::name).orElse(SCOPE_DENY);
    }

    private Set<Long> invalidCustomRoleIds(String tenantId, Map<Long, String> scopesByRoleId) {
        Set<Long> customRoleIds = new HashSet<>();
        for (Map.Entry<Long, String> entry : scopesByRoleId.entrySet()) {
            if (DataScope.fromValue(entry.getValue()).orElse(null) == DataScope.CUSTOM) {
                customRoleIds.add(entry.getKey());
            }
        }
        if (customRoleIds.isEmpty()) {
            return Set.of();
        }

        Set<Long> invalidRoleIds = new HashSet<>();
        Set<Long> departmentIds = new HashSet<>();
        Map<Long, Set<Long>> departmentIdsByRoleId = new HashMap<>();
        List<RoleDept> associations = roleDeptMapper.selectByTenantIdAndRoleIds(tenantId, List.copyOf(customRoleIds));
        if (associations != null) {
            for (RoleDept association : associations) {
                if (association == null
                        || association.getRoleId() == null
                        || association.getDeptId() == null
                        || !tenantId.equals(association.getTenantId())
                        || !customRoleIds.contains(association.getRoleId())) {
                    if (association != null && association.getRoleId() != null) {
                        invalidRoleIds.add(association.getRoleId());
                    }
                    continue;
                }
                if (!departmentIdsByRoleId.computeIfAbsent(association.getRoleId(), ignored -> new HashSet<>())
                        .add(association.getDeptId())) {
                    invalidRoleIds.add(association.getRoleId());
                }
                departmentIds.add(association.getDeptId());
            }
        }
        for (Long roleId : customRoleIds) {
            if (departmentIdsByRoleId.get(roleId) == null || departmentIdsByRoleId.get(roleId).isEmpty()) {
                invalidRoleIds.add(roleId);
            }
        }
        if (departmentIds.isEmpty()) {
            return invalidRoleIds;
        }

        List<Dept> departments = deptMapper.selectList(new QueryWrapper<Dept>()
                .eq("tenant_id", tenantId)
                .eq("deleted", 0)
                .in("id", departmentIds));
        Map<Long, Dept> departmentsById = new HashMap<>();
        if (departments != null) {
            departments.forEach(department -> {
                if (department != null && department.getId() != null) {
                    departmentsById.put(department.getId(), department);
                }
            });
        }
        departmentIdsByRoleId.forEach((roleId, roleDepartmentIds) -> {
            for (Long departmentId : roleDepartmentIds) {
                Dept department = departmentsById.get(departmentId);
                if (department == null || !("1".equals(department.getStatus())
                        || "ACTIVE".equalsIgnoreCase(department.getStatus()))) {
                    invalidRoleIds.add(roleId);
                }
            }
        });
        return invalidRoleIds;
    }

    private String labelFor(String scope) {
        return switch (scope) {
            case SCOPE_DEPT -> "本部门";
            case SCOPE_DEPT_AND_SUB -> "本部门及下属";
            case SCOPE_SELF -> "仅本人";
            case SCOPE_CUSTOM -> "自定义";
            case SCOPE_ALL -> "全部数据";
            default -> "拒绝访问（配置无效）";
        };
    }

    private String riskNoteFor(String scope, String roleName) {
        return switch (scope) {
            case SCOPE_ALL -> roleName + " 可见全部数据，范围最宽。";
            case SCOPE_CUSTOM -> roleName + " 为自定义范围，仅显式角色-部门关联会参与授权。";
            case SCOPE_SELF -> roleName + " 仅可见本人数据，范围最严。";
            case SCOPE_DENY -> roleName + " 的数据权限规则为空、未知或重复，实际访问默认拒绝。";
            default -> "";
        };
    }
}
