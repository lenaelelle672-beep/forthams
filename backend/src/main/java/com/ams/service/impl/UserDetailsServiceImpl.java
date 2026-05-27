package com.ams.service.impl;

import com.ams.entity.User;
import com.ams.mapper.SysMenuMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.security.LoginUser;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 自定义 UserDetailsService 实现。
 *
 * <p>首次请求或缓存失效后从数据库加载用户、角色和菜单权限，构建 {@link LoginUser} 返回。
 * 返回的 LoginUser 替代 Spring Security 内建 User，携带 userId/deptId/roles/permissions
 * 等业务上下文，供 SecurityService(@ss) 和 Controller 层使用。</p>
 */
@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;
    private final SysMenuMapper sysMenuMapper;

    @Override
    @Cacheable(value = "loginUser", key = "#username")
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userMapper.selectOne(
            new LambdaQueryWrapper<User>()
                .eq(User::getUsername, username)
                .eq(User::getStatus, 1)
                .eq(User::getDeleted, 0)
        );

        if (user == null) {
            throw new UsernameNotFoundException("User not found: " + username);
        }

        // 加载角色码列表
        List<String> roleCodes = userRoleMapper.selectRoleCodesByUserId(user.getId());
        if (roleCodes == null) {
            roleCodes = Collections.emptyList();
        }

        // 加载权限码列表
        List<String> permissions;
        try {
            permissions = sysMenuMapper.selectPermsByUserId(user.getId());
        } catch (Exception e) {
            permissions = Collections.emptyList();
        }
        if (permissions == null) {
            permissions = Collections.emptyList();
        }

        // 构建 GrantedAuthority：角色码 + 权限码
        List<SimpleGrantedAuthority> authorities = new ArrayList<>();

        // 角色码 → ROLE_xxx
        for (String roleCode : roleCodes) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + roleCode));
        }

        // 权限码 → perms 直接作为授权项（SecurityService.hasPermi 依赖）
        for (String perm : permissions) {
            authorities.add(new SimpleGrantedAuthority(perm));
        }

        // 兜底：确保用户至少拥有一个角色
        if (authorities.isEmpty()) {
            authorities.add(new SimpleGrantedAuthority("ROLE_USER"));
        }

        // 计算 tenantId（与 AuthService.resolveTenantId 逻辑一致）
        String tenantId = user.getDeptId() != null ? "dept:" + user.getDeptId() : null;

        return new LoginUser(
                user.getId(),
                user.getDeptId(),
                tenantId,
                user.getUsername(),
                user.getPassword(),
                roleCodes,
                permissions,
                authorities
        );
    }
}
