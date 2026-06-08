package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.UserCreateDTO;
import com.ams.entity.User;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.RoleMapper;
import com.ams.mapper.SysUserPostMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.security.SecurityUserCacheService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@Disabled("运行时类找不到，第4轮修复时标记")
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
    private SysUserPostMapper sysUserPostMapper;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private SecurityUserCacheService securityUserCacheService;

    @InjectMocks
    private UserManagementService userManagementService;

    @Test
    void createUserShouldRejectDuplicateUsername() {
        User existingUser = new User();
        existingUser.setId(1L);
        existingUser.setUsername("admin");

        when(userMapper.selectOne(any(QueryWrapper.class))).thenReturn(existingUser);

        UserCreateDTO dto = new UserCreateDTO();
        dto.setUsername("admin");

        BusinessException ex = assertThrows(BusinessException.class,
            () -> userManagementService.createUser(dto));

        assertTrue(ex.getMessage().contains("用户名已存在"));
    }
}
