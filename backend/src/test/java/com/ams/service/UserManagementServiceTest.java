package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.dto.AuthResponse;
import com.ams.dto.UserUpdateDTO;
import com.ams.entity.User;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.RoleDataScopeMapper;
import com.ams.mapper.RoleMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserManagementServiceTest {

    @Mock
    private UserMapper userMapper;

    @Mock
    private RoleMapper roleMapper;

    @Mock
    private UserRoleMapper userRoleMapper;

    @Mock
    private DeptMapper deptMapper;

    @Mock
    private RoleDataScopeMapper roleDataScopeMapper;

    @Mock
    private UserTenantMembershipMapper userTenantMembershipMapper;

    @Mock
    private TenantAuthorityService tenantAuthorityService;

    @Mock
    private PasswordEncoder passwordEncoder;

    private UserManagementService userManagementService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "tenant-admin", null, List.of(
                new SimpleGrantedAuthority("user:update"),
                new SimpleGrantedAuthority("user:reset-password"),
                new SimpleGrantedAuthority("user:delete"))));
        userManagementService = new UserManagementService(userMapper, roleMapper, userRoleMapper, deptMapper,
                roleDataScopeMapper, userTenantMembershipMapper, tenantAuthorityService, passwordEncoder);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void currentUserReturnsRolesPermissionsAndPlatformAdminWithoutPassword() {
        User current = new User();
        current.setId(7L);
        current.setUsername("alice");
        current.setRealName("爱丽丝");
        current.setPassword("$2a$10$hashed-secret");
        current.setPlatformAdmin(true);
        when(tenantAuthorityService.requireCurrentTenantMember()).thenReturn(current);
        when(userRoleMapper.selectRoleCodesByUserIdAndTenantId(7L, "T001")).thenReturn(List.of("TENANT_ADMIN"));
        when(userRoleMapper.selectPermissionCodesByUserIdAndTenantId(7L, "T001")).thenReturn(List.of("user:query"));

        AuthResponse response = userManagementService.getCurrentUser();

        assertEquals(7L, response.getUserId());
        assertEquals("alice", response.getUsername());
        assertEquals(List.of("TENANT_ADMIN"), response.getRoles());
        assertEquals(List.of("user:query"), response.getPermissions());
        assertTrue(response.getPlatformAdmin());
        assertNull(response.getToken());
        assertNull(current.getPassword());
    }

    @Test
    void tenantAdminCannotMutatePlatformAdminAccounts() {
        User platformAdmin = new User();
        platformAdmin.setId(9L);
        platformAdmin.setTenantId("T001");
        platformAdmin.setPlatformAdmin(true);
        platformAdmin.setVersion(0);
        when(userMapper.selectOne(any())).thenReturn(platformAdmin);
        when(userTenantMembershipMapper.countActiveMembership(9L, "T001")).thenReturn(1L);
        doThrow(new AccessDeniedException("需要平台管理员权限"))
                .when(tenantAuthorityService).requirePlatformAdmin();

        assertThrows(AccessDeniedException.class,
                () -> userManagementService.updateUser(9L, new UserUpdateDTO()));
        assertThrows(AccessDeniedException.class, () -> userManagementService.resetPassword(9L));
        assertThrows(AccessDeniedException.class, () -> userManagementService.updateStatus(9L, 0));
        assertThrows(AccessDeniedException.class, () -> userManagementService.deleteUser(9L));

        verify(tenantAuthorityService, times(4)).requirePlatformAdmin();
        verify(tenantAuthorityService, never()).requireTenantAdmin();
        verify(userMapper, never()).update(any(User.class), any());
        verify(userMapper, never()).delete(any());
    }
}
