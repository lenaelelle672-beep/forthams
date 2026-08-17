package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.User;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantAuthorityServiceTest {

    @Mock
    private UserMapper userMapper;

    @Mock
    private UserTenantMembershipMapper userTenantMembershipMapper;

    @InjectMocks
    private TenantAuthorityService tenantAuthorityService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    @Test
    void superAdminRoleCannotReplaceExplicitPlatformAdminMarker() {
        authenticate("alice", "ROLE_SUPER_ADMIN");
        TenantContext.setTenantId("T001");
        User user = user(false);
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user);
        when(userTenantMembershipMapper.countActiveMembership(7L, "T001")).thenReturn(1L);

        assertThatThrownBy(() -> tenantAuthorityService.requirePlatformAdmin())
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("平台管理员");
    }

    @Test
    void explicitPlatformAdminStillRequiresAnActiveMembership() {
        authenticate("alice", "ROLE_TENANT_ADMIN");
        TenantContext.setTenantId("T001");
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user(true));
        when(userTenantMembershipMapper.countActiveMembership(7L, "T001")).thenReturn(0L);

        assertThatThrownBy(() -> tenantAuthorityService.requirePlatformAdmin())
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("未加入当前租户");
    }

    @Test
    void explicitPlatformAdminWithActiveMembershipIsAccepted() {
        authenticate("alice", "ROLE_TENANT_ADMIN");
        TenantContext.setTenantId("T001");
        User user = user(true);
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user);
        when(userTenantMembershipMapper.countActiveMembership(7L, "T001")).thenReturn(1L);

        assertThat(tenantAuthorityService.requirePlatformAdmin()).isSameAs(user);
        assertThat(tenantAuthorityService.requireTenantOrPlatformAdmin()).isSameAs(user);
    }

    @Test
    void tenantAdminWithActiveMembershipCanConfigureTenantWorkflow() {
        authenticate("alice", "ROLE_TENANT_ADMIN");
        TenantContext.setTenantId("T001");
        User user = user(false);
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user);
        when(userTenantMembershipMapper.countActiveMembership(7L, "T001")).thenReturn(1L);

        assertThat(tenantAuthorityService.requireTenantOrPlatformAdmin()).isSameAs(user);
    }

    @Test
    void superAdminRoleCannotReplaceTenantOrPlatformAdminMarker() {
        authenticate("alice", "ROLE_SUPER_ADMIN");
        TenantContext.setTenantId("T001");
        User user = user(false);
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user);
        when(userTenantMembershipMapper.countActiveMembership(7L, "T001")).thenReturn(1L);

        assertThatThrownBy(() -> tenantAuthorityService.requireTenantOrPlatformAdmin())
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("平台管理员或租户管理员");
    }

    private void authenticate(String username, String authority) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                username, "n/a", List.of(new SimpleGrantedAuthority(authority))));
    }

    private User user(boolean platformAdmin) {
        User user = new User();
        user.setId(7L);
        user.setUsername("alice");
        user.setTenantId("T001");
        user.setStatus(1);
        user.setPlatformAdmin(platformAdmin);
        return user;
    }
}
