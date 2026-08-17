package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.dto.RolePermissionCatalogDTO;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class RolePermissionCatalogService {

    private static final String READONLY_NOTICE = "本页不支持分配/编辑/删除，不代表菜单权限或数据权限闭环";

    private static final List<String> RISK_TIPS = List.of(
            READONLY_NOTICE,
            "仅基于当前租户角色及系统权限库存聚合只读目录，不读取用户或数据权限策略。",
            "权限库存来自当前数据库记录，缺少 seed 时不会自动补齐。"
    );

    private final JdbcTemplate jdbcTemplate;

    public RolePermissionCatalogService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public RolePermissionCatalogDTO getCatalog() {
        String tenantId = TenantContext.requireTenantId();
        List<RolePermissionCatalogDTO.RolePermissionRoleDTO> roles = loadRoles(tenantId);
        List<RolePermissionCatalogDTO.RolePermissionPermissionDTO> permissions = loadPermissions();
        List<RolePermissionBinding> bindings = loadBindings(tenantId);

        Map<Long, RolePermissionCatalogDTO.RolePermissionRoleDTO> rolesById = new LinkedHashMap<>();
        roles.forEach(role -> rolesById.put(role.getRoleId(), role));

        Map<Long, RolePermissionCatalogDTO.RolePermissionPermissionDTO> permissionsById = new LinkedHashMap<>();
        permissions.forEach(permission -> permissionsById.put(permission.getPermissionId(), permission));

        Map<Long, Set<Long>> permissionIdsByRole = new LinkedHashMap<>();
        for (RolePermissionBinding binding : bindings) {
            if (rolesById.containsKey(binding.roleId()) && permissionsById.containsKey(binding.permissionId())) {
                permissionIdsByRole.computeIfAbsent(binding.roleId(), ignored -> new LinkedHashSet<>())
                        .add(binding.permissionId());
            }
        }

        Set<Long> boundPermissionIds = new LinkedHashSet<>();
        int bindingCount = 0;
        int rolesWithoutPermissions = 0;
        for (RolePermissionCatalogDTO.RolePermissionRoleDTO role : roles) {
            List<RolePermissionCatalogDTO.RolePermissionPermissionDTO> rolePermissions = permissionIdsByRole
                    .getOrDefault(role.getRoleId(), Set.of())
                    .stream()
                    .map(permissionsById::get)
                    .toList();
            role.setPermissions(rolePermissions);
            role.setPermissionCount(rolePermissions.size());
            bindingCount += rolePermissions.size();
            if (rolePermissions.isEmpty()) {
                rolesWithoutPermissions++;
            }
            rolePermissions.forEach(permission -> boundPermissionIds.add(permission.getPermissionId()));
        }

        RolePermissionCatalogDTO catalog = new RolePermissionCatalogDTO();
        catalog.setRoles(roles);
        catalog.setPermissions(permissions);
        catalog.setRiskTips(RISK_TIPS);
        catalog.setReadonlyNotice(READONLY_NOTICE);

        RolePermissionCatalogDTO.RolePermissionCatalogSummaryDTO summary = new RolePermissionCatalogDTO.RolePermissionCatalogSummaryDTO();
        summary.setRoleCount(roles.size());
        summary.setPermissionInventoryCount(permissions.size());
        summary.setRolePermissionBindingCount(bindingCount);
        summary.setBoundPermissionCount(boundPermissionIds.size());
        summary.setUnboundPermissionCount(Math.max(permissions.size() - boundPermissionIds.size(), 0));
        summary.setRolesWithoutPermissionsCount(rolesWithoutPermissions);
        catalog.setSummary(summary);

        return catalog;
    }

    private List<RolePermissionCatalogDTO.RolePermissionRoleDTO> loadRoles(String tenantId) {
        return jdbcTemplate.query("""
                SELECT id, role_name, role_code, description, status
                FROM sys_role
                WHERE COALESCE(deleted, 0) = 0
                  AND tenant_id = ?
                ORDER BY id
                """, (rs, rowNum) -> {
            RolePermissionCatalogDTO.RolePermissionRoleDTO role = new RolePermissionCatalogDTO.RolePermissionRoleDTO();
            role.setRoleId(rs.getLong("id"));
            role.setRoleName(rs.getString("role_name"));
            role.setRoleCode(rs.getString("role_code"));
            role.setDescription(rs.getString("description"));
            role.setStatus(rs.getObject("status", Integer.class));
            return role;
        }, tenantId);
    }

    private List<RolePermissionCatalogDTO.RolePermissionPermissionDTO> loadPermissions() {
        return jdbcTemplate.query("""
                SELECT id, permission_name, permission_code, description, status
                FROM sys_permission
                WHERE COALESCE(deleted, 0) = 0
                ORDER BY id
                """, (rs, rowNum) -> {
            RolePermissionCatalogDTO.RolePermissionPermissionDTO permission = new RolePermissionCatalogDTO.RolePermissionPermissionDTO();
            permission.setPermissionId(rs.getLong("id"));
            permission.setPermissionName(rs.getString("permission_name"));
            permission.setPermissionCode(rs.getString("permission_code"));
            permission.setDescription(rs.getString("description"));
            permission.setStatus(rs.getObject("status", Integer.class));
            return permission;
        });
    }

    private List<RolePermissionBinding> loadBindings(String tenantId) {
        return jdbcTemplate.query("""
                SELECT rp.role_id, rp.permission_id
                FROM sys_role_permission rp
                INNER JOIN sys_role r ON r.id = rp.role_id
                WHERE COALESCE(r.deleted, 0) = 0
                  AND r.tenant_id = ?
                ORDER BY rp.role_id, rp.permission_id
                """, (rs, rowNum) -> new RolePermissionBinding(
                rs.getLong("role_id"),
                rs.getLong("permission_id")
        ), tenantId);
    }

    private record RolePermissionBinding(Long roleId, Long permissionId) {
    }
}
