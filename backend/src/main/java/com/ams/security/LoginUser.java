package com.ams.security;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * 自定义 UserDetails 实现，携带 forthAMS 业务上下文。
 *
 * <p>打破 Spring Security 内建 User 限制，携带 userId/deptId/tenantId/roles/permissions
 * 等业务字段，供 SecurityService(@ss) 和 Controller 层安全决策使用。</p>
 *
 * <p>由 UserDetailsService 加载并通过 loginUser 缓存复用；用户、角色、菜单变更时主动失效。</p>
 */
@Getter
public class LoginUser implements UserDetails {

    private static final long serialVersionUID = 1L;

    private final Long userId;
    private final Long deptId;
    private final String tenantId;
    private final String username;
    private final String password;
    private final List<String> roles;
    private final List<String> permissions;
    private final Collection<? extends GrantedAuthority> authorities;

    public LoginUser(Long userId, Long deptId, String tenantId,
                     String username, String password,
                     List<String> roles, List<String> permissions,
                     Collection<? extends GrantedAuthority> authorities) {
        this.userId = userId;
        this.deptId = deptId;
        this.tenantId = tenantId;
        this.username = username;
        this.password = password;
        this.roles = roles;
        this.permissions = permissions;
        this.authorities = authorities;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
