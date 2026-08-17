package com.ams.service.impl;

import com.ams.context.TenantContext;
import com.ams.entity.SysTenant;
import com.ams.entity.User;
import com.ams.mapper.SysTenantMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserDetailsServiceImplTest {

    @Mock
    private UserMapper userMapper;

    @Mock
    private UserRoleMapper userRoleMapper;

    @Mock
    private SysTenantMapper sysTenantMapper;

    @Mock
    private UserTenantMembershipMapper userTenantMembershipMapper;

    @InjectMocks
    private UserDetailsServiceImpl userDetailsService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void tenantScopedUserShouldReceiveOnlyConfiguredTenantAuthorities() {
        TenantContext.setTenantId("T001");
        mockUser("admin", "T001");
        when(sysTenantMapper.selectById("T001")).thenReturn(activeTenant("T001"));
        when(userTenantMembershipMapper.countActiveMembership(1L, "T001")).thenReturn(1L);
        when(userRoleMapper.countInvalidTenantRoleAssignments(1L, "T001")).thenReturn(0L);
        when(userRoleMapper.selectRoleCodesByUserIdAndTenantId(1L, "T001"))
                .thenReturn(List.of("SUPER_ADMIN"));
        when(userRoleMapper.selectPermissionCodesByUserIdAndTenantId(1L, "T001"))
                .thenReturn(List.of("system:integration:query"));

        UserDetails details = userDetailsService.loadUserByUsername("admin");

        Set<String> authorities = details.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
        assertTrue(authorities.contains("ROLE_SUPER_ADMIN"));
        assertTrue(authorities.contains("system:integration:query"));
        assertFalse(authorities.contains("system:integration:edit"));
    }

    @Test
    void loginCredentialLookupWithoutTenantShouldNotGrantAuthorities() {
        mockUser("operator", null);

        UserDetails details = userDetailsService.loadUserByUsername("operator");

        assertTrue(details.getAuthorities().isEmpty());
        verifyNoInteractions(userRoleMapper, sysTenantMapper);
    }

    @Test
    void tenantMembershipWithoutTenantScopedRoleShouldBeRejected() {
        TenantContext.setTenantId("T001");
        mockUser("operator", "T001");
        when(sysTenantMapper.selectById("T001")).thenReturn(activeTenant("T001"));
        when(userTenantMembershipMapper.countActiveMembership(1L, "T001")).thenReturn(1L);
        when(userRoleMapper.countInvalidTenantRoleAssignments(1L, "T001")).thenReturn(0L);
        when(userRoleMapper.selectRoleCodesByUserIdAndTenantId(1L, "T001")).thenReturn(List.of());

        assertThrows(UsernameNotFoundException.class,
                () -> userDetailsService.loadUserByUsername("operator"));
    }

    @Test
    void crossTenantOrNullRoleAssignmentRejectsTenantAuthentication() {
        TenantContext.setTenantId("T001");
        mockUser("operator", "T001");
        when(sysTenantMapper.selectById("T001")).thenReturn(activeTenant("T001"));
        when(userTenantMembershipMapper.countActiveMembership(1L, "T001")).thenReturn(1L);
        when(userRoleMapper.countInvalidTenantRoleAssignments(1L, "T001")).thenReturn(1L);

        assertThrows(UsernameNotFoundException.class,
                () -> userDetailsService.loadUserByUsername("operator"));
        verify(userRoleMapper).countInvalidTenantRoleAssignments(1L, "T001");
        verify(userRoleMapper, never()).selectRoleCodesByUserIdAndTenantId(1L, "T001");
    }

    private void mockUser(String username, String tenantId) {
        User user = new User();
        user.setId(1L);
        user.setTenantId(tenantId);
        user.setUsername(username);
        user.setPassword("encoded");
        user.setStatus(1);
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user);
    }

    private SysTenant activeTenant(String tenantId) {
        SysTenant tenant = new SysTenant();
        tenant.setId(tenantId);
        tenant.setStatus("ACTIVE");
        return tenant;
    }
}
