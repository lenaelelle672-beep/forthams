package com.ams.service.impl;

import com.ams.entity.User;
import com.ams.mapper.UserRoleMapper;
import com.ams.mapper.UserMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private static final List<String> SUPER_ADMIN_PERMISSIONS = List.of(
            "system:integration:query",
            "system:integration:edit",
            "system:integration:delete",
            "system:integration:test"
    );

    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userMapper.selectOne(
            new LambdaQueryWrapper<User>()
                .eq(User::getUsername, username)
                .eq(User::getStatus, 1)
        );

        if (user == null) {
            throw new UsernameNotFoundException("User not found: " + username);
        }

        Set<String> authorityCodes = new LinkedHashSet<>();
        List<String> roleCodes = userRoleMapper.selectRoleCodesByUserId(user.getId());
        if (roleCodes != null) {
            for (String roleCode : roleCodes) {
                authorityCodes.add("ROLE_" + roleCode);
            }
        }
        List<String> permissionCodes = userRoleMapper.selectPermissionCodesByUserId(user.getId());
        if (permissionCodes != null) {
            authorityCodes.addAll(permissionCodes);
        }

        if (authorityCodes.contains("ROLE_SUPER_ADMIN")) {
            authorityCodes.addAll(SUPER_ADMIN_PERMISSIONS);
        }

        if (authorityCodes.isEmpty()) {
            authorityCodes.add("ROLE_USER");
        }

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
