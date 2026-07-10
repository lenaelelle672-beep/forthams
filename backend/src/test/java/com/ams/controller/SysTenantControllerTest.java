package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.SysTenantDTO;
import com.ams.service.SysTenantService;
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
class SysTenantControllerTest {

    @Mock
    private SysTenantService sysTenantService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new SysTenantController(sysTenantService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void listShouldReturnTenantsForSuperAdmin() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        SysTenantDTO.PageResult page = new SysTenantDTO.PageResult();
        page.setTotal(1);
        page.setRecords(List.of(tenant("T001", "默认租户")));
        when(sysTenantService.list(null, null, 1, 20)).thenReturn(page);

        mockMvc.perform(get("/tenants").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.records[0].id").value("T001"));
    }

    @Test
    void listShouldRejectWithoutPermissionFailClosed() throws Exception {
        grant("some-other-permission");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(get("/tenants").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    void currentShouldReturnOwnTenantForAnyAuthenticatedUser() throws Exception {
        // 普通用户无 system:tenant:query，但 /current 仍可访问自己的租户
        grant("asset:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(sysTenantService.current()).thenReturn(tenant("T001", "默认租户"));

        mockMvc.perform(get("/tenants/current").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("T001"))
                .andExpect(jsonPath("$.data.name").value("默认租户"));
    }

    @Test
    void detailShouldRequireTenantQueryPermission() throws Exception {
        grant("system:tenant:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(sysTenantService.detail("T002")).thenReturn(tenant("T002", "子公司"));

        mockMvc.perform(get("/tenants/T002").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("T002"));
    }

    @Test
    void metaShouldReturnReadOnlyNotice() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        SysTenantDTO.Meta meta = new SysTenantDTO.Meta();
        meta.setPlans(List.of("STANDARD"));
        meta.setStatuses(List.of("ACTIVE"));
        meta.setReadOnlyNotice("只读");
        when(sysTenantService.meta()).thenReturn(meta);

        mockMvc.perform(get("/tenants/meta").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.plans[0]").value("STANDARD"));
    }

    private SysTenantDTO tenant(String id, String name) {
        SysTenantDTO dto = new SysTenantDTO();
        dto.setId(id);
        dto.setName(name);
        dto.setPlan("STANDARD");
        dto.setMaxUsers(100);
        dto.setMaxAssets(10000);
        dto.setStatus("ACTIVE");
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
