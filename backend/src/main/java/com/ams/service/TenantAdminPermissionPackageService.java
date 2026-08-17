package com.ams.service;

import com.ams.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

/** 受控地将首位租户管理员业务权限包绑定到刚创建的 tenant-scoped 角色。 */
@Service
@RequiredArgsConstructor
public class TenantAdminPermissionPackageService {

    private final JdbcTemplate jdbcTemplate;

    /**
     * 该操作必须加入租户开通事务。每项绑定先验证库存，再使用幂等 insert，
     * 最后验证恰好存在一条绑定；任何目录漂移、重复绑定或租户错配均回滚开通。
     */
    @Transactional(propagation = Propagation.MANDATORY, rollbackFor = Exception.class)
    public Set<String> bindToRole(String tenantId, Long roleId) {
        if (tenantId == null || tenantId.isBlank() || roleId == null) {
            throw new BusinessException("初始租户管理员权限绑定参数不完整");
        }

        Integer matchingRoleCount = jdbcTemplate.queryForObject("""
                SELECT COUNT(1)
                FROM sys_role
                WHERE id = ?
                  AND tenant_id = ?
                  AND status = 1
                  AND COALESCE(deleted, 0) = 0
                """, Integer.class, roleId, tenantId);
        if (matchingRoleCount == null || matchingRoleCount != 1) {
            throw new BusinessException("初始租户管理员角色不属于当前租户或不可用");
        }

        for (TenantAdminPermissionPackage.PermissionDefinition definition
                : TenantAdminPermissionPackage.definitions()) {
            List<Long> permissionIds = jdbcTemplate.queryForList("""
                    SELECT id
                    FROM sys_permission
                    WHERE permission_code = ?
                      AND status = 1
                      AND COALESCE(deleted, 0) = 0
                    """, Long.class, definition.permissionCode());
            if (permissionIds.size() != 1) {
                throw new BusinessException("初始租户管理员权限库存缺失或不唯一: "
                        + definition.permissionCode());
            }

            Long permissionId = permissionIds.get(0);
            jdbcTemplate.update("""
                    INSERT INTO sys_role_permission (role_id, permission_id)
                    SELECT ?, ?
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM sys_role_permission
                        WHERE role_id = ?
                          AND permission_id = ?
                    )
                    """, roleId, permissionId, roleId, permissionId);

            Integer bindingCount = jdbcTemplate.queryForObject("""
                    SELECT COUNT(1)
                    FROM sys_role_permission
                    WHERE role_id = ?
                      AND permission_id = ?
                    """, Integer.class, roleId, permissionId);
            if (bindingCount == null || bindingCount != 1) {
                throw new BusinessException("初始租户管理员权限绑定不完整或重复: "
                        + definition.permissionCode());
            }
        }
        return TenantAdminPermissionPackage.permissionCodes();
    }
}
