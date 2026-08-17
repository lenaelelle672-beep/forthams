package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.RolePermissionCatalogDTO;
import com.ams.service.RolePermissionCatalogService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Arrays;
import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class RolePermissionCatalogControllerTest {

    @Mock
    private RolePermissionCatalogService rolePermissionCatalogService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new RolePermissionCatalogController(rolePermissionCatalogService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void getCatalogShouldRequireRolePermissionQueryPermission() throws Exception {
        grant("system:role-permission:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(rolePermissionCatalogService.getCatalog()).thenReturn(sampleCatalog());

        mockMvc.perform(get("/system/role-permissions/catalog")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.summary.roleCount").value(1))
                .andExpect(jsonPath("$.data.summary.permissionInventoryCount").value(2))
                .andExpect(jsonPath("$.data.roles[0].permissionCount").value(2))
                .andExpect(jsonPath("$.data.readonlyNotice").value("本页不支持分配/编辑/删除，不代表菜单权限或数据权限闭环"));

        verify(rolePermissionCatalogService).getCatalog();
    }

    @Test
    void getCatalogShouldRejectSuperAdminWithoutExplicitPermission() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(get("/system/role-permissions/catalog")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(rolePermissionCatalogService);
    }

    @Test
    void getCatalogShouldRejectMissingBearerToken() throws Exception {
        grant("system:role-permission:query");

        mockMvc.perform(get("/system/role-permissions/catalog"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(rolePermissionCatalogService);
    }

    @Test
    void getCatalogShouldRejectUserWithoutRolePermissionQueryPermission() throws Exception {
        grant("system:user:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(get("/system/role-permissions/catalog")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(rolePermissionCatalogService);
    }

    private RolePermissionCatalogDTO sampleCatalog() {
        RolePermissionCatalogDTO.RolePermissionPermissionDTO integrationPermission = permission(10L, "接口查询", "system:integration:query");
        RolePermissionCatalogDTO.RolePermissionPermissionDTO rolePermission = permission(11L, "角色权限查询", "system:role-permission:query");

        RolePermissionCatalogDTO.RolePermissionRoleDTO role = new RolePermissionCatalogDTO.RolePermissionRoleDTO();
        role.setRoleId(1L);
        role.setRoleName("超级管理员");
        role.setRoleCode("SUPER_ADMIN");
        role.setStatus(1);
        role.setPermissions(List.of(integrationPermission, rolePermission));
        role.setPermissionCount(2);

        RolePermissionCatalogDTO.RolePermissionCatalogSummaryDTO summary = new RolePermissionCatalogDTO.RolePermissionCatalogSummaryDTO();
        summary.setRoleCount(1);
        summary.setPermissionInventoryCount(2);
        summary.setRolePermissionBindingCount(2);
        summary.setBoundPermissionCount(2);

        RolePermissionCatalogDTO catalog = new RolePermissionCatalogDTO();
        catalog.setRoles(List.of(role));
        catalog.setPermissions(List.of(integrationPermission, rolePermission));
        catalog.setSummary(summary);
        catalog.setReadonlyNotice("本页不支持分配/编辑/删除，不代表菜单权限或数据权限闭环");
        catalog.setRiskTips(List.of(catalog.getReadonlyNotice()));
        return catalog;
    }

    private RolePermissionCatalogDTO.RolePermissionPermissionDTO permission(Long id, String name, String code) {
        RolePermissionCatalogDTO.RolePermissionPermissionDTO permission = new RolePermissionCatalogDTO.RolePermissionPermissionDTO();
        permission.setPermissionId(id);
        permission.setPermissionName(name);
        permission.setPermissionCode(code);
        permission.setStatus(1);
        return permission;
    }

    private void grant(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin",
                "n/a",
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()
        ));
    }
}
