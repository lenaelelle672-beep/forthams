package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.DataPermissionCatalogDTO;
import com.ams.service.DataPermissionCatalogService;
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

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class DataPermissionCatalogControllerTest {

    @Mock
    private DataPermissionCatalogService dataPermissionCatalogService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new DataPermissionCatalogController(dataPermissionCatalogService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void catalogShouldReturnRolesWithDataScope() throws Exception {
        grant("system:role-permission:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(dataPermissionCatalogService.getCatalog()).thenReturn(catalog());

        mockMvc.perform(get("/system/data-permissions/catalog").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.roles[0].roleCode").value("ADMIN"))
                .andExpect(jsonPath("$.data.roles[0].dataScope").value("ALL"))
                .andExpect(jsonPath("$.data.summary.allScopeCount").value(1))
                .andExpect(jsonPath("$.data.summary.customScopeCount").value(1));
    }

    @Test
    void catalogShouldAcceptSuperAdmin() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(dataPermissionCatalogService.getCatalog()).thenReturn(catalog());

        mockMvc.perform(get("/system/data-permissions/catalog").header("Authorization", "Bearer token"))
                .andExpect(status().isOk());
    }

    @Test
    void catalogShouldRejectWithoutPermissionFailClosed() throws Exception {
        grant("some-other-permission");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(get("/system/data-permissions/catalog").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    private DataPermissionCatalogDTO catalog() {
        DataPermissionCatalogDTO dto = new DataPermissionCatalogDTO();
        DataPermissionCatalogDTO.RoleDataScope r1 = new DataPermissionCatalogDTO.RoleDataScope();
        r1.setRoleId(1L);
        r1.setRoleName("管理员");
        r1.setRoleCode("ADMIN");
        r1.setDataScope("ALL");
        r1.setDataScopeLabel("全部数据");
        r1.setCustomScope(false);
        DataPermissionCatalogDTO.RoleDataScope r2 = new DataPermissionCatalogDTO.RoleDataScope();
        r2.setRoleId(2L);
        r2.setRoleName("自定义角色");
        r2.setRoleCode("CUSTOM_ROLE");
        r2.setDataScope("CUSTOM");
        r2.setDataScopeLabel("自定义");
        r2.setCustomScope(true);
        dto.setRoles(List.of(r1, r2));
        dto.getSummary().setRoleCount(2);
        dto.getSummary().setAllScopeCount(1);
        dto.getSummary().setRestrictedScopeCount(0);
        dto.getSummary().setCustomScopeCount(1);
        dto.setRiskTips(List.of("有 1 个角色持有 ALL 范围。"));
        dto.setReadOnlyNotice("只读");
        return dto;
    }

    private void grant(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin",
                "n/a",
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()
        ));
    }
}
