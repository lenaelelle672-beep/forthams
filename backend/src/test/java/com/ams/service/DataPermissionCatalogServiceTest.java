package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.dto.DataPermissionCatalogDTO;
import com.ams.entity.Dept;
import com.ams.entity.Role;
import com.ams.entity.RoleDataScopeRule;
import com.ams.entity.RoleDept;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.RoleDataScopeMapper;
import com.ams.mapper.RoleDeptMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

/**
 * 数据权限只读 catalog 服务测试。
 *
 * 安全重点：空、未知及无效 CUSTOM 关联必须展示为 DENY，目录和执行策略保持一致。
 */
@ExtendWith(MockitoExtension.class)
class DataPermissionCatalogServiceTest {

    @Mock
    private RoleService roleService;

    @Mock
    private RoleDataScopeMapper roleDataScopeMapper;

    @Mock
    private RoleDeptMapper roleDeptMapper;

    @Mock
    private DeptMapper deptMapper;

    private DataPermissionCatalogService service;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        service = new DataPermissionCatalogService(roleService, roleDataScopeMapper, roleDeptMapper, deptMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void normalizeScopeShouldDenyNullOrBlankOrUnknown() {
        givenRoles(
                role(1L, "null-scope-role", "NULL_SCOPE", null),
                role(2L, "blank-scope-role", "BLANK_SCOPE", "   "),
                role(3L, "unknown-scope-role", "UNKNOWN_SCOPE", "WAT")
        );

        DataPermissionCatalogDTO catalog = service.getCatalog();

        assertEquals(3, catalog.getRoles().size());
        assertEquals("DENY", catalog.getRoles().get(0).getDataScope());
        assertEquals("DENY", catalog.getRoles().get(1).getDataScope());
        assertEquals("DENY", catalog.getRoles().get(2).getDataScope());
        assertEquals(0, catalog.getSummary().getAllScopeCount());
        assertEquals(3, catalog.getSummary().getRestrictedScopeCount());
        assertEquals(0, catalog.getSummary().getCustomScopeCount());
        assertTrue(catalog.getRiskTips().stream().anyMatch(tip -> tip.contains("3") && tip.contains("默认拒绝")));
        assertFalse(catalog.getRiskTips().stream().anyMatch(tip -> tip.contains("CUSTOM")));
    }

    @Test
    void normalizeScopeShouldUppercaseKnownScopes() {
        givenRoles(
                role(1L, "self", "SELF_ROLE", "  self  "),
                role(2L, "dept", "DEPT_ROLE", "dept_and_sub")
        );

        DataPermissionCatalogDTO catalog = service.getCatalog();

        assertEquals("SELF", catalog.getRoles().get(0).getDataScope());
        assertEquals("仅本人", catalog.getRoles().get(0).getDataScopeLabel());
        assertEquals("DEPT_AND_SUB", catalog.getRoles().get(1).getDataScope());
        assertEquals("本部门及下属", catalog.getRoles().get(1).getDataScopeLabel());
        // SELF / DEPT_AND_SUB 都计入受限范围
        assertEquals(2, catalog.getSummary().getRestrictedScopeCount());
        assertEquals(0, catalog.getSummary().getAllScopeCount());
        // 受限范围不产生风险提示
        assertTrue(catalog.getRiskTips().isEmpty());
    }

    @Test
    void allScopeShouldIncrementCountAndGenerateRiskTip() {
        givenRoles(
                role(1L, "超级管理员", "SUPER_ADMIN", "ALL")
        );

        DataPermissionCatalogDTO catalog = service.getCatalog();

        assertEquals("ALL", catalog.getRoles().get(0).getDataScope());
        assertEquals("全部数据", catalog.getRoles().get(0).getDataScopeLabel());
        assertFalse(catalog.getRoles().get(0).isCustomScope());
        assertEquals("超级管理员 可见全部数据，范围最宽。", catalog.getRoles().get(0).getRiskNote());
        assertEquals(1, catalog.getSummary().getAllScopeCount());
        assertEquals(0, catalog.getSummary().getRestrictedScopeCount());
        assertEquals(0, catalog.getSummary().getCustomScopeCount());
        assertTrue(catalog.getRiskTips().stream().anyMatch(tip -> tip.contains("1") && tip.contains("ALL")));
    }

    @Test
    void customScopeShouldIncrementCountGenerateRiskTipAndFlagCustom() {
        givenRoles(
                role(7L, "自定义角色", "CUSTOM_ROLE", "CUSTOM")
        );

        DataPermissionCatalogDTO catalog = service.getCatalog();

        assertEquals("CUSTOM", catalog.getRoles().get(0).getDataScope());
        assertEquals("自定义", catalog.getRoles().get(0).getDataScopeLabel());
        assertTrue(catalog.getRoles().get(0).isCustomScope());
        assertEquals("自定义角色 为自定义范围，仅显式角色-部门关联会参与授权。", catalog.getRoles().get(0).getRiskNote());
        assertEquals(1, catalog.getSummary().getCustomScopeCount());
        assertEquals(0, catalog.getSummary().getAllScopeCount());
        assertTrue(catalog.getRiskTips().stream().anyMatch(tip -> tip.contains("1") && tip.contains("CUSTOM")));
    }

    @Test
    void deptAndSelfScopesShouldBeCountedAsRestrictedWithoutRiskTip() {
        givenRoles(
                role(1L, "部门角色", "DEPT_ROLE", "DEPT"),
                role(2L, "个人角色", "SELF_ROLE", "SELF")
        );

        DataPermissionCatalogDTO catalog = service.getCatalog();

        assertEquals("DEPT", catalog.getRoles().get(0).getDataScope());
        assertEquals("本部门", catalog.getRoles().get(0).getDataScopeLabel());
        assertFalse(catalog.getRoles().get(0).isCustomScope());
        assertEquals("", catalog.getRoles().get(0).getRiskNote());
        assertEquals("SELF", catalog.getRoles().get(1).getDataScope());
        assertEquals("仅本人", catalog.getRoles().get(1).getDataScopeLabel());
        assertEquals("个人角色 仅可见本人数据，范围最严。", catalog.getRoles().get(1).getRiskNote());
        assertEquals(2, catalog.getSummary().getRestrictedScopeCount());
        assertEquals(0, catalog.getSummary().getAllScopeCount());
        assertEquals(0, catalog.getSummary().getCustomScopeCount());
        assertTrue(catalog.getRiskTips().isEmpty());
    }

    @Test
    void summaryCountsShouldReflectMixedScopeDistribution() {
        givenRoles(
                role(1L, "A", "A", "ALL"),
                role(2L, "B", "B", "ALL"),
                role(3L, "C", "C", "CUSTOM"),
                role(4L, "D", "D", "DEPT"),
                role(5L, "E", "E", "DEPT_AND_SUB"),
                role(6L, "F", "F", "SELF"),
                role(7L, "G", "G", "LEGACY")
        );

        DataPermissionCatalogDTO catalog = service.getCatalog();

        assertEquals(7, catalog.getSummary().getRoleCount());
        assertEquals(2, catalog.getSummary().getAllScopeCount());
        assertEquals(1, catalog.getSummary().getCustomScopeCount());
        assertEquals(4, catalog.getSummary().getRestrictedScopeCount());
        assertEquals(3, catalog.getRiskTips().size());
    }

    @Test
    void emptyRolesShouldProduceZeroCountsAndReadOnlyNotice() {
        givenRoles();

        DataPermissionCatalogDTO catalog = service.getCatalog();

        assertEquals(0, catalog.getRoles().size());
        assertEquals(0, catalog.getSummary().getRoleCount());
        assertEquals(0, catalog.getSummary().getAllScopeCount());
        assertEquals(0, catalog.getSummary().getRestrictedScopeCount());
        assertEquals(0, catalog.getSummary().getCustomScopeCount());
        assertTrue(catalog.getRiskTips().isEmpty());
        assertTrue(catalog.getReadOnlyNotice().contains("数据权限目录为只读"));
    }

    @Test
    void customScopeWithMissingOrDisabledDepartmentShouldBeReportedAsDeny() {
        Role customRole = role(7L, "自定义角色", "CUSTOM_ROLE", "CUSTOM");
        when(roleService.listAllRoles()).thenReturn(List.of(customRole));
        when(roleDataScopeMapper.selectByTenantId("T001")).thenReturn(List.of(rule(7L, "CUSTOM")));
        when(roleDeptMapper.selectByTenantIdAndRoleIds("T001", List.of(7L))).thenReturn(List.of());

        DataPermissionCatalogDTO catalog = service.getCatalog();

        assertEquals("DENY", catalog.getRoles().get(0).getDataScope());
        assertFalse(catalog.getRoles().get(0).isCustomScope());
    }

    @Test
    void duplicateCustomDepartmentAssociationShouldBeReportedAsDeny() {
        Role customRole = role(7L, "自定义角色", "CUSTOM_ROLE", "CUSTOM");
        when(roleService.listAllRoles()).thenReturn(List.of(customRole));
        when(roleDataScopeMapper.selectByTenantId("T001")).thenReturn(List.of(rule(7L, "CUSTOM")));
        RoleDept duplicate = roleDept(7L, 10L);
        when(roleDeptMapper.selectByTenantIdAndRoleIds("T001", List.of(7L)))
                .thenReturn(List.of(duplicate, duplicate));
        when(deptMapper.selectList(org.mockito.ArgumentMatchers.any())).thenReturn(List.of(dept(10L)));

        DataPermissionCatalogDTO catalog = service.getCatalog();

        assertEquals("DENY", catalog.getRoles().get(0).getDataScope());
        assertFalse(catalog.getRoles().get(0).isCustomScope());
    }

    private Role role(Long id, String name, String code, String dataScope) {
        Role role = new Role();
        role.setId(id);
        role.setRoleName(name);
        role.setRoleCode(code);
        role.setDataScope(dataScope);
        return role;
    }

    private void givenRoles(Role... roles) {
        List<Role> roleList = List.of(roles);
        when(roleService.listAllRoles()).thenReturn(roleList);
        when(roleDataScopeMapper.selectByTenantId("T001")).thenReturn(roleList.stream()
                .map(role -> rule(role.getId(), role.getDataScope()))
                .toList());
        List<RoleDept> associations = roleList.stream()
                .filter(role -> "CUSTOM".equals(role.getDataScope()))
                .map(role -> roleDept(role.getId(), role.getId() + 100L))
                .toList();
        if (!associations.isEmpty()) {
            when(roleDeptMapper.selectByTenantIdAndRoleIds("T001", associations.stream()
                    .map(RoleDept::getRoleId)
                    .toList())).thenReturn(associations);
            when(deptMapper.selectList(org.mockito.ArgumentMatchers.any())).thenReturn(associations.stream()
                    .map(association -> dept(association.getDeptId()))
                    .toList());
        }
    }

    private RoleDataScopeRule rule(Long roleId, String dataScope) {
        RoleDataScopeRule rule = new RoleDataScopeRule();
        rule.setTenantId("T001");
        rule.setRoleId(roleId);
        rule.setDataScope(dataScope);
        return rule;
    }

    private RoleDept roleDept(Long roleId, Long deptId) {
        RoleDept roleDept = new RoleDept();
        roleDept.setTenantId("T001");
        roleDept.setRoleId(roleId);
        roleDept.setDeptId(deptId);
        return roleDept;
    }

    private Dept dept(Long id) {
        Dept dept = new Dept();
        dept.setId(id);
        dept.setTenantId("T001");
        dept.setStatus("1");
        return dept;
    }
}
