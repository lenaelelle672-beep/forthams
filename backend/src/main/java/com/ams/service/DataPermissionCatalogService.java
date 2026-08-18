package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.DataPermissionCatalogDTO;
import com.ams.entity.Role;
import com.ams.entity.RoleDept;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.RoleDeptMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 数据权限只读 catalog 服务。
 *
 * 复用 RoleService 读取角色列表，映射每个角色的 dataScope 为可读标签与风险提示。
 * catalog 展示只读；范围变更走 updateRoleDataScope。
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
    private final RoleDeptMapper roleDeptMapper;
    private final DeptMapper deptMapper;

    public DataPermissionCatalogDTO getCatalog() {
        List<Role> roles = roleService.listAllRoles();
        Map<Long, List<Long>> deptsByRole = loadCustomDeptsByRole();

        DataPermissionCatalogDTO catalog = new DataPermissionCatalogDTO();
        List<String> riskTips = new ArrayList<>();
        int allCount = 0;
        int restrictedCount = 0;
        int customCount = 0;
        int customMissingDeptCount = 0;

        for (Role role : roles) {
            List<Long> deptIds = deptsByRole.getOrDefault(role.getId(), List.of());
            DataPermissionCatalogDTO.RoleDataScope item = toItem(role, deptIds);
            if (SCOPE_ALL.equals(item.getDataScope())) {
                allCount++;
            } else if (SCOPE_CUSTOM.equals(item.getDataScope())) {
                customCount++;
                if (deptIds.isEmpty()) {
                    customMissingDeptCount++;
                }
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
            riskTips.add("有 " + customCount + " 个角色为 CUSTOM 范围，查询运行时仍未按部门清单过滤。");
        }
        if (customMissingDeptCount > 0) {
            riskTips.add("有 " + customMissingDeptCount + " 个 CUSTOM 角色尚未配置部门清单。");
        }
        catalog.setRiskTips(riskTips);
        catalog.setReadOnlyNotice("可收紧角色 dataScope，并可配置 CUSTOM 部门清单；仍不代表查询运行时闭环。");
        return catalog;
    }

    @Transactional(rollbackFor = Exception.class)
    public DataPermissionCatalogDTO.RoleDataScope updateRoleDataScope(Long roleId, String dataScope) {
        Role role = roleService.updateDataScope(roleId, dataScope);
        if (!SCOPE_CUSTOM.equals(normalizeScope(role.getDataScope()))) {
            roleDeptMapper.deleteByRoleId(roleId);
        }
        return toItem(role, listDeptIds(roleId));
    }

    public DataPermissionCatalogDTO.RoleDataScope getRoleCustomDepts(Long roleId) {
        Role role = roleService.getRoleById(roleId);
        return toItem(role, listDeptIds(roleId));
    }

    @Transactional(rollbackFor = Exception.class)
    public DataPermissionCatalogDTO.RoleDataScope replaceCustomDepts(Long roleId, List<Long> deptIds) {
        Role role = roleService.getRoleById(roleId);
        if (!SCOPE_CUSTOM.equals(normalizeScope(role.getDataScope()))) {
            throw new BusinessException("仅 CUSTOM 范围可配置部门清单");
        }
        List<Long> normalized = normalizeDeptIds(deptIds);
        roleDeptMapper.deleteByRoleId(roleId);
        for (Long deptId : normalized) {
            RoleDept binding = new RoleDept();
            binding.setRoleId(roleId);
            binding.setDeptId(deptId);
            roleDeptMapper.insert(binding);
        }
        return toItem(role, normalized);
    }

    private DataPermissionCatalogDTO.RoleDataScope toItem(Role role, List<Long> deptIds) {
        DataPermissionCatalogDTO.RoleDataScope item = new DataPermissionCatalogDTO.RoleDataScope();
        item.setRoleId(role.getId());
        item.setRoleName(role.getRoleName());
        item.setRoleCode(role.getRoleCode());
        String scope = normalizeScope(role.getDataScope());
        item.setDataScope(scope);
        item.setDataScopeLabel(labelFor(scope));
        item.setCustomScope(SCOPE_CUSTOM.equals(scope));
        item.setCustomDeptIds(deptIds);
        item.setCustomDeptCount(deptIds.size());
        item.setRiskNote(riskNoteFor(scope, role.getRoleName(), deptIds.size()));
        return item;
    }

    private Map<Long, List<Long>> loadCustomDeptsByRole() {
        Map<Long, List<Long>> result = new LinkedHashMap<>();
        List<RoleDept> bindings = roleDeptMapper.selectAllBindings();
        if (bindings == null) {
            return result;
        }
        for (RoleDept binding : bindings) {
            if (binding.getRoleId() == null || binding.getDeptId() == null) {
                continue;
            }
            result.computeIfAbsent(binding.getRoleId(), ignored -> new ArrayList<>()).add(binding.getDeptId());
        }
        return result;
    }

    private List<Long> listDeptIds(Long roleId) {
        List<Long> deptIds = roleDeptMapper.selectDeptIdsByRoleId(roleId);
        return deptIds == null ? List.of() : List.copyOf(deptIds);
    }

    private List<Long> normalizeDeptIds(List<Long> raw) {
        Set<Long> unique = new LinkedHashSet<>();
        if (raw != null) {
            for (Long deptId : raw) {
                if (deptId == null || deptId <= 0) {
                    throw new BusinessException("部门 ID 不合法");
                }
                if (deptMapper.selectById(deptId) == null) {
                    throw new BusinessException("部门不存在");
                }
                unique.add(deptId);
            }
        }
        return List.copyOf(unique);
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

    private String riskNoteFor(String scope, String roleName, int customDeptCount) {
        return switch (scope) {
            case SCOPE_ALL -> roleName + " 可见全部数据，范围最宽。";
            case SCOPE_CUSTOM -> customDeptCount == 0
                    ? roleName + " 为自定义范围，尚未配置部门清单。"
                    : roleName + " 为自定义范围，已配置 " + customDeptCount + " 个部门。";
            case SCOPE_SELF -> roleName + " 仅可见本人数据，范围最严。";
            default -> "";
        };
    }
}
