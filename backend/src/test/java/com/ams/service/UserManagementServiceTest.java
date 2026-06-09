package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.UserCreateDTO;
import com.ams.dto.RoleCreateDTO;
import com.ams.entity.Role;
import com.ams.entity.User;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.RoleMapper;
import com.ams.mapper.SysUserPostMapper;
import com.ams.mapper.SysRoleDeptMapper;
import com.ams.mapper.SysRoleMenuMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.security.SecurityUserCacheService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserManagementServiceTest {

    @Mock
    private UserMapper userMapper;

    @Mock
    private RoleMapper roleMapper;

    @Mock
    private SysRoleMenuMapper sysRoleMenuMapper;

    @Mock
    private SysRoleDeptMapper sysRoleDeptMapper;

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

    private RoleService roleService;

    @BeforeEach
    void setUp() {
        roleService = new RoleService(roleMapper, sysRoleMenuMapper, sysRoleDeptMapper, securityUserCacheService);
    }

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

    @Test
    void createRoleShouldDefaultToDepartmentDataScope() {
        when(roleMapper.selectCount(any(QueryWrapper.class))).thenReturn(0L);

        RoleCreateDTO dto = new RoleCreateDTO();
        dto.setRoleName("资产管理员");
        dto.setRoleCode("ASSET_MANAGER");

        roleService.createRole(dto);

        ArgumentCaptor<Role> captor = ArgumentCaptor.forClass(Role.class);
        verify(roleMapper).insert(captor.capture());
        assertEquals(3, captor.getValue().getDataScope());
    }
}
