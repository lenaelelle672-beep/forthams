package com.ams.service.impl;

import com.ams.context.TenantContext;
import com.ams.entity.SysTenant;
import com.ams.entity.User;
import com.ams.mapper.SysTenantMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;
    private final SysTenantMapper sysTenantMapper;
    private final UserTenantMembershipMapper userTenantMembershipMapper;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = loadActiveUser(username);
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            // DaoAuthenticationProvider 在登录校验密码时尚未选择租户；此路径只验证凭证，
            // 绝不授予默认角色或权限。AuthService 会在签发 JWT 前验证成员关系和租户角色。
            return toUserDetails(user, Collections.emptySet());
        }
        return loadUserByUsernameAndTenantId(username, user.getId(), tenantId);
    }

    public UserDetails loadUserByUsernameAndTenantId(String username, Long userId, String tenantId)
            throws UsernameNotFoundException {
        if (username == null || username.isBlank() || userId == null || tenantId == null || tenantId.isBlank()) {
            throw new UsernameNotFoundException("Tenant membership not found");
        }

        SysTenant tenant = sysTenantMapper.selectById(tenantId);
        if (tenant == null || !"ACTIVE".equalsIgnoreCase(tenant.getStatus())) {
            throw new UsernameNotFoundException("Tenant membership not found");
        }

        User user = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getId, userId)
                .eq(User::getUsername, username)
                .eq(User::getTenantId, tenantId)
                .eq(User::getStatus, 1));
        if (user == null) {
            throw new UsernameNotFoundException("Tenant membership not found");
        }
        if (userTenantMembershipMapper.countActiveMembership(user.getId(), tenantId) != 1) {
            throw new UsernameNotFoundException("Tenant membership not found");
        }
        if (userRoleMapper.countInvalidTenantRoleAssignments(user.getId(), tenantId) > 0) {
            throw new UsernameNotFoundException("Tenant role not found");
        }

        Set<String> authorityCodes = new LinkedHashSet<>();
        List<String> roleCodes = userRoleMapper.selectRoleCodesByUserIdAndTenantId(user.getId(), tenantId);
        if (roleCodes != null) {
            for (String roleCode : roleCodes) {
                if (roleCode != null && !roleCode.isBlank()) {
                    authorityCodes.add("ROLE_" + roleCode);
                }
            }
        }
        if (authorityCodes.isEmpty()) {
            throw new UsernameNotFoundException("Tenant role not found");
        }

        List<String> permissionCodes = userRoleMapper.selectPermissionCodesByUserIdAndTenantId(user.getId(), tenantId);
        if (permissionCodes != null) {
            permissionCodes.stream()
                    .filter(permissionCode -> permissionCode != null && !permissionCode.isBlank())
                    .forEach(authorityCodes::add);
        }
        return toUserDetails(user, authorityCodes);
    }

    /** JWT 每次请求都以数据库中的 token_version 作为撤销检查的权威来源。 */
    public Integer getCurrentTokenVersion(String username, Long userId, String tenantId)
            throws UsernameNotFoundException {
        if (username == null || username.isBlank() || userId == null || tenantId == null || tenantId.isBlank()) {
            throw new UsernameNotFoundException("Tenant membership not found");
        }
        User user = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getId, userId)
                .eq(User::getUsername, username)
                .eq(User::getTenantId, tenantId)
                .eq(User::getStatus, 1));
        if (user == null || userTenantMembershipMapper.countActiveMembership(user.getId(), tenantId) != 1) {
            throw new UsernameNotFoundException("Tenant membership not found");
        }
        return user.getTokenVersion() == null ? 0 : user.getTokenVersion();
    }

    private User loadActiveUser(String username) {
        User user = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getUsername, username)
                .eq(User::getStatus, 1));
        if (user == null) {
            throw new UsernameNotFoundException("User not found: " + username);
        }
        return user;
    }

    private UserDetails toUserDetails(User user, Set<String> authorityCodes) {
        List<SimpleGrantedAuthority> authorities = authorityCodes.stream()
                .map(SimpleGrantedAuthority::new)
                .toList();
        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getUsername())
                .password(user.getPassword())
                .authorities(authorities)
                .build();
    }

}
