package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.SysTenantDTO;
import com.ams.dto.TenantProvisionRequest;
import com.ams.entity.GeneralAuditEntry;
import com.ams.entity.Role;
import com.ams.entity.RoleDataScopeRule;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantProvisioningServiceTest {

    @Mock
    private TenantAuthorityService tenantAuthorityService;

    @Mock
    private SysTenantMapper sysTenantMapper;

    @Mock
    private UserMapper userMapper;

    @Mock
    private UserTenantMembershipMapper userTenantMembershipMapper;

    @Mock
    private RoleMapper roleMapper;

    @Mock
    private RoleDataScopeMapper roleDataScopeMapper;

    @Mock
    private UserRoleMapper userRoleMapper;

    @Mock
    private TenantAdminPermissionPackageService tenantAdminPermissionPackageService;

    @Mock
    private AuditLogMapper auditLogMapper;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private TenantProvisioningService tenantProvisioningService;

    @Test
    void onlyExplicitPlatformAdminCanProvisionTenant() {
        when(tenantAuthorityService.requirePlatformAdmin())
                .thenThrow(new AccessDeniedException("仅显式平台管理员可以管理租户"));

        assertThatThrownBy(() -> tenantProvisioningService.provision(request()))
                .isInstanceOf(AccessDeniedException.class);

        verify(sysTenantMapper, never()).insertTenant(any());
    }

    @Test
    void provisioningCreatesTenantAdminMembershipAllScopeAndAuditTogether() {
        User platformAdmin = new User();
        platformAdmin.setId(1L);
        platformAdmin.setUsername("platform-admin");
        when(tenantAuthorityService.requirePlatformAdmin()).thenReturn(platformAdmin);
        when(sysTenantMapper.selectById("T002")).thenReturn(null);
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        when(sysTenantMapper.insertTenant(any())).thenReturn(1);
        doAnswer(invocation -> {
            Role role = invocation.getArgument(0);
            role.setId(21L);
            return 1;
        }).when(roleMapper).insert(any(Role.class));
        when(roleDataScopeMapper.insert(any(RoleDataScopeRule.class))).thenReturn(1);
        when(tenantAdminPermissionPackageService.bindToRole("T002", 21L))
                .thenReturn(TenantAdminPermissionPackage.permissionCodes());
        doAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(31L);
            return 1;
        }).when(userMapper).insert(any(User.class));
        when(userTenantMembershipMapper.insert(any(UserTenantMembership.class))).thenReturn(1);
        when(userRoleMapper.insert(any(UserRole.class))).thenReturn(1);
        when(auditLogMapper.insertAuditEntry(any(GeneralAuditEntry.class))).thenReturn(1);
        when(passwordEncoder.encode("strong-password")).thenReturn("encoded-password");

        SysTenantDTO result = tenantProvisioningService.provision(request());

        assertThat(result.getId()).isEqualTo("T002");
        assertThat(TenantAdminPermissionPackage.permissionCodes()).contains(
                "asset:create", "retirement:create", "disposal:create", "workorder:submit");
        assertThat(TenantAdminPermissionPackage.permissionCodes())
                .doesNotContain("system:flow:query")
                .noneMatch(permission -> permission.startsWith("workflow:designer:"));
        ArgumentCaptor<RoleDataScopeRule> scopeCaptor = ArgumentCaptor.forClass(RoleDataScopeRule.class);
        verify(roleDataScopeMapper).insert(scopeCaptor.capture());
        assertThat(scopeCaptor.getValue().getTenantId()).isEqualTo("T002");
        assertThat(scopeCaptor.getValue().getRoleId()).isEqualTo(21L);
        assertThat(scopeCaptor.getValue().getDataScope()).isEqualTo("ALL");

        ArgumentCaptor<UserTenantMembership> membershipCaptor = ArgumentCaptor.forClass(UserTenantMembership.class);
        verify(userTenantMembershipMapper).insert(membershipCaptor.capture());
        assertThat(membershipCaptor.getValue().getUserId()).isEqualTo(31L);
        assertThat(membershipCaptor.getValue().getTenantId()).isEqualTo("T002");
        assertThat(membershipCaptor.getValue().getCreatedBy()).isEqualTo(1L);

        ArgumentCaptor<GeneralAuditEntry> auditCaptor = ArgumentCaptor.forClass(GeneralAuditEntry.class);
        verify(auditLogMapper).insertAuditEntry(auditCaptor.capture());
        assertThat(auditCaptor.getValue().getTenantId()).isEqualTo("T002");
        assertThat(auditCaptor.getValue().getOperatorId()).isEqualTo(1L);
        assertThat(auditCaptor.getValue().getAfterRecord()).doesNotContain("strong-password");
        assertThat(auditCaptor.getValue().getAfterRecord())
                .contains(TenantAdminPermissionPackage.PACKAGE_CODE)
                .contains("permissionCount=" + TenantAdminPermissionPackage.permissionCodes().size());
        verify(tenantAdminPermissionPackageService).bindToRole("T002", 21L);
    }

    @Test
    void provisioningFailsClosedWhenAuditCannotBePersisted() {
        User platformAdmin = new User();
        platformAdmin.setId(1L);
        when(tenantAuthorityService.requirePlatformAdmin()).thenReturn(platformAdmin);
        when(sysTenantMapper.selectById("T002")).thenReturn(null);
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        when(sysTenantMapper.insertTenant(any())).thenReturn(1);
        doAnswer(invocation -> {
            ((Role) invocation.getArgument(0)).setId(21L);
            return 1;
        }).when(roleMapper).insert(any(Role.class));
        when(roleDataScopeMapper.insert(any(RoleDataScopeRule.class))).thenReturn(1);
        when(tenantAdminPermissionPackageService.bindToRole("T002", 21L))
                .thenReturn(TenantAdminPermissionPackage.permissionCodes());
        doAnswer(invocation -> {
            ((User) invocation.getArgument(0)).setId(31L);
            return 1;
        }).when(userMapper).insert(any(User.class));
        when(userTenantMembershipMapper.insert(any(UserTenantMembership.class))).thenReturn(1);
        when(userRoleMapper.insert(any(UserRole.class))).thenReturn(1);
        when(auditLogMapper.insertAuditEntry(any(GeneralAuditEntry.class))).thenReturn(0);
        when(passwordEncoder.encode("strong-password")).thenReturn("encoded-password");

        assertThatThrownBy(() -> tenantProvisioningService.provision(request()))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("审计记录");
    }

    private TenantProvisionRequest request() {
        TenantProvisionRequest request = new TenantProvisionRequest();
        request.setTenantId("T002");
        request.setTenantName("Tenant Two");
        request.setAdminUsername("tenant-admin");
        request.setAdminPassword("strong-password");
        request.setAdminRealName("Tenant Admin");
        return request;
    }
}
