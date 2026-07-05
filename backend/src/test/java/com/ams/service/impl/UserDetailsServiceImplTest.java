package com.ams.service.impl;

import com.ams.entity.User;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserDetailsServiceImplTest {

    @Mock
    private UserMapper userMapper;

    @Mock
    private UserRoleMapper userRoleMapper;

    @InjectMocks
    private UserDetailsServiceImpl userDetailsService;

    @Test
    void superAdminRoleShouldReceiveSystemIntegrationAuthorities() {
        mockUser("admin");
        when(userRoleMapper.selectRoleCodesByUserId(1L)).thenReturn(List.of("SUPER_ADMIN"));
        when(userRoleMapper.selectPermissionCodesByUserId(1L)).thenReturn(List.of());

        UserDetails details = userDetailsService.loadUserByUsername("admin");

        Set<String> authorities = details.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
        assertTrue(authorities.contains("ROLE_SUPER_ADMIN"));
        assertTrue(authorities.contains("system:integration:query"));
        assertTrue(authorities.contains("system:integration:edit"));
        assertTrue(authorities.contains("system:integration:delete"));
        assertTrue(authorities.contains("system:integration:test"));
    }

    @Test
    void normalRoleShouldReceiveConfiguredPermissionAuthorities() {
        mockUser("operator");
        when(userRoleMapper.selectRoleCodesByUserId(1L)).thenReturn(List.of("USER"));
        when(userRoleMapper.selectPermissionCodesByUserId(1L)).thenReturn(List.of(
                "system:integration:query",
                "system:integration:test"
        ));

        UserDetails details = userDetailsService.loadUserByUsername("operator");

        Set<String> authorities = details.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
        assertTrue(authorities.contains("ROLE_USER"));
        assertTrue(authorities.contains("system:integration:query"));
        assertTrue(authorities.contains("system:integration:test"));
        assertFalse(authorities.contains("system:integration:delete"));
    }

    private void mockUser(String username) {
        User user = new User();
        user.setId(1L);
        user.setUsername(username);
        user.setPassword("encoded");
        user.setStatus(1);
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user);
    }
}
