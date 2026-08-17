package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.SysTenantDTO;
import com.ams.dto.TenantProvisionRequest;
import com.ams.entity.GeneralAuditEntry;
import com.ams.entity.Role;
import com.ams.entity.RoleDataScopeRule;
import com.ams.entity.SysTenant;
import com.ams.entity.User;
import com.ams.entity.UserRole;
import com.ams.entity.UserTenantMembership;
import com.ams.mapper.AuditLogMapper;
import com.ams.mapper.RoleDataScopeMapper;
import com.ams.mapper.RoleMapper;
import com.ams.mapper.SysTenantMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class TenantProvisioningService {

    private static final String TENANT_ADMIN_ROLE_CODE = "TENANT_ADMIN";

    private final TenantAuthorityService tenantAuthorityService;
    private final SysTenantMapper sysTenantMapper;
    private final UserMapper userMapper;
    private final UserTenantMembershipMapper userTenantMembershipMapper;
    private final RoleMapper roleMapper;
    private final RoleDataScopeMapper roleDataScopeMapper;
    private final UserRoleMapper userRoleMapper;
    private final TenantAdminPermissionPackageService tenantAdminPermissionPackageService;
    private final AuditLogMapper auditLogMapper;
    private final PasswordEncoder passwordEncoder;

    @Transactional(rollbackFor = Exception.class)
    public SysTenantDTO provision(TenantProvisionRequest request) {
        if (request == null) {
            throw new BusinessException("租户开通请求不能为空");
        }
        User platformAdmin = tenantAuthorityService.requirePlatformAdmin();
        String tenantId = requireTrimmed(request.getTenantId(), "租户标识不能为空");
        String username = requireTrimmed(request.getAdminUsername(), "初始租户管理员用户名不能为空");
        rejectExistingProvisioningState(tenantId, username);

        try {
            SysTenant tenant = new SysTenant();
            tenant.setId(tenantId);
            tenant.setName(requireTrimmed(request.getTenantName(), "租户名称不能为空"));
            tenant.setPlan(defaultIfBlank(request.getPlan(), "STANDARD"));
            tenant.setMaxUsers(request.getMaxUsers() == null ? 100 : request.getMaxUsers());
            tenant.setMaxAssets(request.getMaxAssets() == null ? 10_000 : request.getMaxAssets());
            tenant.setStatus("ACTIVE");
            if (sysTenantMapper.insertTenant(tenant) != 1) {
                throw new BusinessException("租户开通失败");
            }

            Role tenantAdminRole = new Role();
            tenantAdminRole.setTenantId(tenantId);
            tenantAdminRole.setRoleName("租户管理员");
            tenantAdminRole.setRoleCode(TENANT_ADMIN_ROLE_CODE);
            tenantAdminRole.setDescription("由平台管理员开通的首位租户管理员");
            tenantAdminRole.setStatus(1);
            if (roleMapper.insert(tenantAdminRole) != 1 || tenantAdminRole.getId() == null) {
                throw new BusinessException("初始租户管理员角色开通失败");
            }

            RoleDataScopeRule initialScope = new RoleDataScopeRule();
            initialScope.setTenantId(tenantId);
            initialScope.setRoleId(tenantAdminRole.getId());
            initialScope.setDataScope("ALL");
            if (roleDataScopeMapper.insert(initialScope) != 1) {
                throw new BusinessException("初始租户管理员数据范围开通失败");
            }
            java.util.Set<String> grantedPermissionCodes = tenantAdminPermissionPackageService
                    .bindToRole(tenantId, tenantAdminRole.getId());
            if (grantedPermissionCodes == null
                    || grantedPermissionCodes.size() != TenantAdminPermissionPackage.permissionCodes().size()) {
                throw new BusinessException("初始租户管理员权限包绑定不完整");
            }

            User tenantAdmin = new User();
            tenantAdmin.setTenantId(tenantId);
            tenantAdmin.setUsername(username);
            tenantAdmin.setPassword(passwordEncoder.encode(request.getAdminPassword()));
            tenantAdmin.setRealName(requireTrimmed(request.getAdminRealName(), "初始租户管理员姓名不能为空"));
            tenantAdmin.setEmail(trimToNull(request.getAdminEmail()));
            tenantAdmin.setPhone(trimToNull(request.getAdminPhone()));
            tenantAdmin.setStatus(1);
            tenantAdmin.setPlatformAdmin(false);
            if (userMapper.insert(tenantAdmin) != 1 || tenantAdmin.getId() == null) {
                throw new BusinessException("初始租户管理员开通失败");
            }

            UserTenantMembership membership = new UserTenantMembership();
            membership.setUserId(tenantAdmin.getId());
            membership.setTenantId(tenantId);
            membership.setStatus(1);
            membership.setCreatedBy(platformAdmin.getId());
            if (userTenantMembershipMapper.insert(membership) != 1) {
                throw new BusinessException("初始租户管理员成员关系开通失败");
            }

            UserRole userRole = new UserRole();
            userRole.setUserId(tenantAdmin.getId());
            userRole.setRoleId(tenantAdminRole.getId());
            if (userRoleMapper.insert(userRole) != 1) {
                throw new BusinessException("初始租户管理员角色绑定失败");
            }

            persistProvisionAudit(platformAdmin, tenantAdmin, tenant, grantedPermissionCodes.size());
            return toDTO(tenant);
        } catch (DataIntegrityViolationException ex) {
            throw new BusinessException("租户或初始租户管理员已存在，拒绝重复开通");
        }
    }

    private void rejectExistingProvisioningState(String tenantId, String username) {
        if (sysTenantMapper.selectById(tenantId) != null) {
            throw new BusinessException("租户已存在，拒绝重复开通");
        }
        User existingUser = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getUsername, username));
        if (existingUser != null) {
            throw new BusinessException("初始租户管理员用户名已存在");
        }
    }

    private void persistProvisionAudit(User platformAdmin, User tenantAdmin, SysTenant tenant, int permissionCount) {
        GeneralAuditEntry audit = new GeneralAuditEntry();
        LocalDateTime now = LocalDateTime.now();
        audit.setTenantId(tenant.getId());
        audit.setTimestamp(now);
        audit.setCreatedAt(now);
        audit.setOperationType("TENANT_PROVISION");
        audit.setAction("provision_initial_tenant_admin");
        audit.setOperatorId(platformAdmin.getId());
        audit.setOperatorName(platformAdmin.getUsername());
        audit.setResourceType("TENANT");
        audit.setResourceId(tenant.getId());
        audit.setDescription("平台管理员开通租户及首位租户管理员");
        audit.setStatus("SUCCESS");
        audit.setAfterRecord("initialTenantAdminId=" + tenantAdmin.getId() + ",initialRole=" + TENANT_ADMIN_ROLE_CODE
                + ",initialDataScope=ALL,permissionPackage=" + TenantAdminPermissionPackage.PACKAGE_CODE
                + ",permissionCount=" + permissionCount);
        if (auditLogMapper.insertAuditEntry(audit) != 1) {
            throw new BusinessException("租户开通审计记录写入失败");
        }
    }

    private SysTenantDTO toDTO(SysTenant tenant) {
        SysTenantDTO dto = new SysTenantDTO();
        dto.setId(tenant.getId());
        dto.setName(tenant.getName());
        dto.setPlan(tenant.getPlan());
        dto.setMaxUsers(tenant.getMaxUsers());
        dto.setMaxAssets(tenant.getMaxAssets());
        dto.setStatus(tenant.getStatus());
        return dto;
    }

    private String requireTrimmed(String value, String message) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            throw new BusinessException(message);
        }
        return trimmed;
    }

    private String defaultIfBlank(String value, String defaultValue) {
        String trimmed = trimToNull(value);
        return trimmed == null ? defaultValue : trimmed;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
