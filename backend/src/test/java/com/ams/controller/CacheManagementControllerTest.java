package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.CacheNamespaceStatus;
import com.ams.dto.CacheRefreshResult;
import com.ams.service.CacheManagementService;
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

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class CacheManagementControllerTest {

    @Mock
    private CacheManagementService cacheManagementService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new CacheManagementController(cacheManagementService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void listNamespacesShouldRequireCacheQueryPermission() throws Exception {
        grant("system:cache:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(cacheManagementService.listNamespaces()).thenReturn(List.of(namespaceStatus("workbench-v3-menu-metadata")));

        mockMvc.perform(get("/system/cache/namespaces")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].namespace").value("workbench-v3-menu-metadata"))
                .andExpect(jsonPath("$.data[0].observable").value(true));

        verify(cacheManagementService).listNamespaces();
    }

    @Test
    void listNamespacesShouldRejectMissingBearerToken() throws Exception {
        mockMvc.perform(get("/system/cache/namespaces"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(cacheManagementService);
    }

    @Test
    void refreshNamespaceShouldRequireCacheRefreshPermission() throws Exception {
        grant("system:cache:refresh");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(cacheManagementService.refreshNamespace("workbench-v3-menu-metadata"))
                .thenReturn(result("workbench-v3-menu-metadata", "CLEARED", true));

        mockMvc.perform(post("/system/cache/namespaces/{namespace}/refresh", "workbench-v3-menu-metadata")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CLEARED"))
                .andExpect(jsonPath("$.data.success").value(true));

        verify(cacheManagementService).refreshNamespace("workbench-v3-menu-metadata");
    }

    @Test
    void refreshAllShouldReturnPerNamespaceResults() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(cacheManagementService.refreshAll()).thenReturn(List.of(
                result("workbench-v3-menu-metadata", "CLEARED", true),
                result("system-runtime-diagnostics", "CLEARED_EMPTY", false)
        ));

        mockMvc.perform(post("/system/cache/refresh")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].status").value("CLEARED"))
                .andExpect(jsonPath("$.data[1].status").value("CLEARED_EMPTY"));

        verify(cacheManagementService).refreshAll();
    }

    @Test
    void refreshShouldRejectUserWithoutRefreshPermission() throws Exception {
        grant("system:cache:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(post("/system/cache/refresh")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(cacheManagementService);
    }

    private CacheNamespaceStatus namespaceStatus(String namespace) {
        CacheNamespaceStatus status = new CacheNamespaceStatus();
        status.setNamespace(namespace);
        status.setDisplayName("Workbench V3 菜单元数据");
        status.setObservable(true);
        status.setReason("ConcurrentMapCache 可观测");
        status.setEntryCount(1);
        status.setEmpty(false);
        return status;
    }

    private CacheRefreshResult result(String namespace, String status, boolean success) {
        CacheRefreshResult result = new CacheRefreshResult();
        result.setNamespace(namespace);
        result.setStatus(status);
        result.setSuccess(success);
        result.setMessage(status);
        result.setClearedEntries(success ? 1 : 0);
        result.setRefreshedAt(LocalDateTime.now());
        return result;
    }

    private void grant(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin",
                "n/a",
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()
        ));
    }
}
