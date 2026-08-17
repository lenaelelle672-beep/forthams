package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.common.exception.BusinessException;
import com.ams.dto.DeptUpdateDTO;
import com.ams.entity.Dept;
import com.ams.entity.RoleDataScopeRule;
import com.ams.entity.User;
import com.ams.entity.UserRole;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.RoleDataScopeMapper;
import com.ams.mapper.RoleDeptMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;

@ExtendWith(MockitoExtension.class)
class DeptServiceTest {

    @Mock
    private DeptMapper deptMapper;

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private UserMapper userMapper;

    @Mock
    private RoleDeptMapper roleDeptMapper;

    @Mock
    private RoleDataScopeMapper roleDataScopeMapper;

    @Mock
    private UserRoleMapper userRoleMapper;

    @Mock
    private TenantAuthorityService tenantAuthorityService;

    private DeptService deptService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        deptService = new DeptService(deptMapper, assetMapper, userMapper, roleDeptMapper, roleDataScopeMapper,
                userRoleMapper, tenantAuthorityService);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void reparentRejectsAnExpansionOfAnExistingDeptAndSubScope() {
        Dept root = dept(10L, 0L);
        Dept moving = dept(20L, 0L);
        RoleDataScopeRule scope = new RoleDataScopeRule();
        scope.setRoleId(3L);
        scope.setTenantId("T001");
        scope.setDataScope("DEPT_AND_SUB");
        UserRole userRole = new UserRole();
        userRole.setUserId(7L);
        userRole.setRoleId(3L);
        User scopedUser = new User();
        scopedUser.setId(7L);
        scopedUser.setTenantId("T001");
        scopedUser.setDeptId(10L);
        scopedUser.setStatus(1);
        scopedUser.setDeleted(0);
        when(deptMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(root, moving), List.of(root, moving));
        when(deptMapper.selectOne(any(QueryWrapper.class))).thenReturn(moving, root);
        when(roleDataScopeMapper.selectByTenantId("T001")).thenReturn(List.of(scope));
        when(userRoleMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(userRole));
        when(userMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(scopedUser));

        DeptUpdateDTO dto = new DeptUpdateDTO();
        dto.setName("待移动部门");
        dto.setDeptCode("MOVING");
        dto.setParentId(10L);
        dto.setSortOrder(1);

        assertThrows(AccessDeniedException.class, () -> deptService.updateDept(20L, dto));

        verify(tenantAuthorityService).requireTenantAdmin();
        verify(deptMapper, never()).update(any(Dept.class), any());
    }

    @Test
    void nonTenantAdminCannotReparentBeforeLockingTheDepartmentTree() {
        doThrow(new AccessDeniedException("仅租户管理员可以管理租户成员"))
                .when(tenantAuthorityService).requireTenantAdmin();

        assertThrows(AccessDeniedException.class,
                () -> deptService.updateDept(20L, new DeptUpdateDTO()));

        verify(tenantAuthorityService).requireTenantAdmin();
        verifyNoInteractions(deptMapper);
    }

    @Test
    void deleteRequiresTenantAdminBeforeReadingOrMutatingTheDepartmentTree() {
        doThrow(new AccessDeniedException("仅租户管理员可以管理租户成员"))
                .when(tenantAuthorityService).requireTenantAdmin();

        assertThrows(AccessDeniedException.class, () -> deptService.deleteDept(20L));

        verify(tenantAuthorityService).requireTenantAdmin();
        verifyNoInteractions(deptMapper, assetMapper, userMapper, roleDeptMapper);
    }

    @Test
    void deleteRejectsDepartmentReferencedByAnAssetInTheCurrentTenant() {
        Dept department = dept(20L, 0L);
        when(deptMapper.selectOne(any(QueryWrapper.class))).thenReturn(department);
        when(assetMapper.countByTenantIdAndDeptIdIncludingDeleted("T001", 20L)).thenReturn(1L);

        assertThrows(BusinessException.class, () -> deptService.deleteDept(20L));

        verify(tenantAuthorityService).requireTenantAdmin();
        verify(deptMapper, never()).delete(any(QueryWrapper.class));
    }

    private Dept dept(Long id, Long parentId) {
        Dept dept = new Dept();
        dept.setId(id);
        dept.setTenantId("T001");
        dept.setParentId(parentId);
        dept.setStatus("1");
        dept.setVersion(0);
        return dept;
    }
}
