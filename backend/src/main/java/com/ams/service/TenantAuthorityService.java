package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.User;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TenantAuthorityService {

    private static final String TENANT_ADMIN_ROLE = "ROLE_TENANT_ADMIN";

    private final UserMapper userMapper;
    private final UserTenantMembershipMapper userTenantMembershipMapper;

    public User requireCurrentTenantMember() {
        String tenantId = TenantContext.requireTenantId();
        Authentication authentication = requireAuthentication();
        User user = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getUsername, authentication.getName())
                .eq(User::getTenantId, tenantId)
                .eq(User::getStatus, 1));
        if (user == null || user.getId() == null
                || userTenantMembershipMapper.countActiveMembership(user.getId(), tenantId) != 1) {
            throw new AccessDeniedException("当前用户未加入当前租户或已停用");
        }
        return user;
    }

    public User requireTenantAdmin() {
        User user = requireCurrentTenantMember();
        if (!hasTenantAdminRole()) {
            throw new AccessDeniedException("仅租户管理员可以管理租户成员");
        }
        return user;
    }

    public User requireTenantOrPlatformAdmin() {
        User user = requireCurrentTenantMember();
        if (!Boolean.TRUE.equals(user.getPlatformAdmin()) && !hasTenantAdminRole()) {
            throw new AccessDeniedException("仅显式平台管理员或租户管理员可以执行该操作");
        }
        return user;
    }

    public User requirePlatformAdmin() {
        User user = requireCurrentTenantMember();
        if (!Boolean.TRUE.equals(user.getPlatformAdmin())) {
            throw new AccessDeniedException("仅显式平台管理员可以管理租户");
        }
        return user;
    }

    private boolean hasTenantAdminRole() {
        return requireAuthentication().getAuthorities().stream()
                .anyMatch(authority -> TENANT_ADMIN_ROLE.equals(authority.getAuthority()));
    }

    private Authentication requireAuthentication() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || authentication instanceof AnonymousAuthenticationToken
                || !authentication.isAuthenticated()
                || authentication.getName() == null
                || authentication.getName().isBlank()) {
            throw new AccessDeniedException("缺少已认证用户");
        }
        return authentication;
    }
}
