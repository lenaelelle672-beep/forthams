package com.ams.service;

import com.ams.entity.Dept;
import com.ams.entity.Role;
import com.ams.entity.User;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.RoleDeptMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.security.DataScope;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DataScopeServiceTest {

    @Mock
    private UserMapper userMapper;
    @Mock
    private UserRoleMapper userRoleMapper;
    @Mock
    private RoleDeptMapper roleDeptMapper;
    @Mock
    private DeptMapper deptMapper;
    @Mock
    private AssetMapper assetMapper;

    private DataScopeService service;

    @BeforeEach
    void setUp() {
        service = new DataScopeService(userMapper, userRoleMapper, roleDeptMapper, deptMapper, assetMapper);
    }

    @Test
    void allRoleShouldSeeEverything() {
        DataScope scope = service.resolve(user(9L, 3L), List.of(role(1L, "ALL")));

        assertTrue(scope.seesAll());
        assertTrue(scope.allows(99L, 8L));
    }

    @Test
    void selfRoleShouldOnlySeeOwnAssets() {
        DataScope scope = service.resolve(user(9L, 3L), List.of(role(1L, "SELF")));

        assertFalse(scope.seesAll());
        assertTrue(scope.allows(3L, 9L));
        assertFalse(scope.allows(3L, 8L));
    }

    @Test
    void deptRoleShouldOnlySeeOwnDepartment() {
        DataScope scope = service.resolve(user(9L, 3L), List.of(role(1L, "DEPT")));

        assertTrue(scope.allows(3L, 8L));
        assertFalse(scope.allows(4L, 8L));
    }

    @Test
    void deptAndSubShouldIncludeDescendants() {
        Dept child = new Dept();
        child.setId(4L);
        child.setParentId(3L);
        when(deptMapper.selectList(null)).thenReturn(List.of(child));

        DataScope scope = service.resolve(user(9L, 3L), List.of(role(1L, "DEPT_AND_SUB")));

        assertTrue(scope.allows(3L, 8L));
        assertTrue(scope.allows(4L, 8L));
        assertFalse(scope.allows(5L, 8L));
    }

    @Test
    void customRoleShouldUseConfiguredDepartments() {
        when(roleDeptMapper.selectDeptIdsByRoleId(7L)).thenReturn(List.of(11L, 12L));

        DataScope scope = service.resolve(user(9L, 3L), List.of(role(7L, "CUSTOM")));

        assertTrue(scope.allows(11L, 8L));
        assertFalse(scope.allows(3L, 8L));
    }

    @Test
    void emptyRolesShouldSeeNothing() {
        DataScope scope = service.resolve(user(9L, 3L), List.of());

        assertFalse(scope.allows(3L, 9L));
        assertFalse(scope.seesAll());
    }

    @Test
    void mixedRolesShouldUnionAndKeepSelf() {
        when(roleDeptMapper.selectDeptIdsByRoleId(7L)).thenReturn(List.of(11L));

        DataScope scope = service.resolve(user(9L, 3L), List.of(role(1L, "SELF"), role(7L, "CUSTOM")));

        assertTrue(scope.allows(11L, 8L));
        assertTrue(scope.allows(99L, 9L));
        assertFalse(scope.allows(3L, 8L));
    }

    private static User user(Long id, Long deptId) {
        User user = new User();
        user.setId(id);
        user.setDeptId(deptId);
        return user;
    }

    private static Role role(Long id, String dataScope) {
        Role role = new Role();
        role.setId(id);
        role.setDataScope(dataScope);
        return role;
    }
}
