package com.ams.service;

import com.ams.dto.DataPermissionCatalogDTO;
import com.ams.entity.Role;
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
 * 安全重点：normalizeScope() 对 null/blank/未知值采用"放宽到 ALL"的默认策略
 * （default -> SCOPE_ALL），即把未知/空数据范围视作最宽权限。该行为是刻意设计
 * （catalog 只读，先暴露风险），必须在测试中显式锁定并文档化，避免后续被静默收紧/放宽。
 */
@ExtendWith(MockitoExtension.class)
class DataPermissionCatalogServiceTest {

    @Mock
    private RoleService roleService;

    private DataPermissionCatalogService service;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        service = new DataPermissionCatalogService(roleService);
    }

    @Test
    void normalizeScopeShouldWidenNullOrBlankOrUnknownToAllAsSecurityDefault() {
        // null / blank / 未知值 → ALL（最宽权限）。这是刻意的"放宽默认"策略：
        // catalog 只读，优先把潜在的最宽权限暴露出来由人工收紧，而不是隐藏风险。
        // 锁定该行为，防止被悄悄改成收紧默认（会漏报风险）或抛异常（catalog 只读，不应阻断）。
        when(roleService.listAllRoles()).thenReturn(List.of(
                role(1L, "null-scope-role", "NULL_SCOPE", null),
                role(2L, "blank-scope-role", "BLANK_SCOPE", "   "),
                role(3L, "unknown-scope-role", "UNKNOWN_SCOPE", "WAT")
        ));

        DataPermissionCatalogDTO catalog = service.getCatalog();

        assertEquals(3, catalog.getRoles().size());
        assertEquals("ALL", catalog.getRoles().get(0).getDataScope());
        assertEquals("ALL", catalog.getRoles().get(1).getDataScope());
        assertEquals("ALL", catalog.getRoles().get(2).getDataScope());
        // ALL 角色计数=3，受限=0，自定义=0
        assertEquals(3, catalog.getSummary().getAllScopeCount());
        assertEquals(0, catalog.getSummary().getRestrictedScopeCount());
        assertEquals(0, catalog.getSummary().getCustomScopeCount());
        // 全部归一为 ALL → 产生风险提示
        assertTrue(catalog.getRiskTips().stream().anyMatch(tip -> tip.contains("3") && tip.contains("ALL")));
        assertFalse(catalog.getRiskTips().stream().anyMatch(tip -> tip.contains("CUSTOM")));
    }

    @Test
    void normalizeScopeShouldUppercaseKnownScopes() {
        // 已知范围的大小写归一（trim + toUpperCase），不改变语义。
        when(roleService.listAllRoles()).thenReturn(List.of(
                role(1L, "self", "SELF_ROLE", "  self  "),
                role(2L, "dept", "DEPT_ROLE", "dept_and_sub")
        ));

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
        when(roleService.listAllRoles()).thenReturn(List.of(
                role(1L, "超级管理员", "SUPER_ADMIN", "ALL")
        ));

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
        when(roleService.listAllRoles()).thenReturn(List.of(
                role(7L, "自定义角色", "CUSTOM_ROLE", "CUSTOM")
        ));

        DataPermissionCatalogDTO catalog = service.getCatalog();

        assertEquals("CUSTOM", catalog.getRoles().get(0).getDataScope());
        assertEquals("自定义", catalog.getRoles().get(0).getDataScopeLabel());
        assertTrue(catalog.getRoles().get(0).isCustomScope());
        assertEquals("自定义角色 为自定义范围，需配合数据权限规则。", catalog.getRoles().get(0).getRiskNote());
        assertEquals(1, catalog.getSummary().getCustomScopeCount());
        assertEquals(0, catalog.getSummary().getAllScopeCount());
        assertTrue(catalog.getRiskTips().stream().anyMatch(tip -> tip.contains("1") && tip.contains("CUSTOM")));
    }

    @Test
    void deptAndSelfScopesShouldBeCountedAsRestrictedWithoutRiskTip() {
        when(roleService.listAllRoles()).thenReturn(List.of(
                role(1L, "部门角色", "DEPT_ROLE", "DEPT"),
                role(2L, "个人角色", "SELF_ROLE", "SELF")
        ));

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
        when(roleService.listAllRoles()).thenReturn(List.of(
                role(1L, "A", "A", "ALL"),
                role(2L, "B", "B", "ALL"),
                role(3L, "C", "C", "CUSTOM"),
                role(4L, "D", "D", "DEPT"),
                role(5L, "E", "E", "DEPT_AND_SUB"),
                role(6L, "F", "F", "SELF"),
                role(7L, "G", "G", "LEGACY")
        ));

        DataPermissionCatalogDTO catalog = service.getCatalog();

        // ALL: 真实 ALL(2) + 未知 LEGACY(1) = 3
        assertEquals(7, catalog.getSummary().getRoleCount());
        assertEquals(3, catalog.getSummary().getAllScopeCount());
        assertEquals(1, catalog.getSummary().getCustomScopeCount());
        assertEquals(3, catalog.getSummary().getRestrictedScopeCount());
        // ALL + CUSTOM 风险提示各一条
        assertEquals(2, catalog.getRiskTips().size());
    }

    @Test
    void emptyRolesShouldProduceZeroCountsAndReadOnlyNotice() {
        when(roleService.listAllRoles()).thenReturn(List.of());

        DataPermissionCatalogDTO catalog = service.getCatalog();

        assertEquals(0, catalog.getRoles().size());
        assertEquals(0, catalog.getSummary().getRoleCount());
        assertEquals(0, catalog.getSummary().getAllScopeCount());
        assertEquals(0, catalog.getSummary().getRestrictedScopeCount());
        assertEquals(0, catalog.getSummary().getCustomScopeCount());
        assertTrue(catalog.getRiskTips().isEmpty());
        assertTrue(catalog.getReadOnlyNotice().contains("只读 catalog"));
    }

    private Role role(Long id, String name, String code, String dataScope) {
        Role role = new Role();
        role.setId(id);
        role.setRoleName(name);
        role.setRoleCode(code);
        role.setDataScope(dataScope);
        return role;
    }
}
