package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.SystemConfigDTO;
import com.ams.dto.SystemConfigPreviewDTO;
import com.ams.dto.SystemConfigRefreshResultDTO;
import com.ams.service.SystemConfigService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class SystemConfigControllerTest {

    @Mock
    private SystemConfigService systemConfigService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new SystemConfigController(systemConfigService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldRejectMissingBearerMissingUserMissingAuthenticationAndMissingPermission() throws Exception {
        mockMvc.perform(get("/system-config/system"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        when(jwtUtil.getUserIdFromToken("token")).thenReturn(null);
        grant("system:config:query");
        mockMvc.perform(get("/system-config/system").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        SecurityContextHolder.clearContext();
        when(jwtUtil.getUserIdFromToken("token2")).thenReturn(42L);
        mockMvc.perform(get("/system-config/system").header("Authorization", "Bearer token2"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        grant("system:config:query");
        when(jwtUtil.getUserIdFromToken("token3")).thenReturn(42L);
        mockMvc.perform(post("/system/configs/refresh-cache")
                        .header("Authorization", "Bearer token3")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationPayload()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(systemConfigService);
    }

    @Test
    void shouldExposeSystemAndSecurityCompatibilityWrappersWithoutRawSensitiveValues() throws Exception {
        grant("system:config:query", "system:config:edit");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(systemConfigService.getGroupConfig("SYSTEM")).thenReturn(Map.of("systemName", "AMS"));
        when(systemConfigService.getGroupConfig("SECURITY")).thenReturn(Map.of("minLength", "******"));
        when(systemConfigService.saveGroupConfig(eq("SYSTEM"), any(), eq(42L))).thenReturn(Map.of("systemName", "AMS Pro"));
        when(systemConfigService.saveGroupConfig(eq("SECURITY"), any(), eq(42L))).thenReturn(Map.of("minLength", "******"));

        mockMvc.perform(get("/system-config/system").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.systemName").value("AMS"));

        mockMvc.perform(put("/system-config/system")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(groupPayload("systemName", "AMS Pro")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.systemName").value("AMS Pro"));

        mockMvc.perform(get("/system-config/security").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.minLength").value("******"))
                .andExpect(content().string(not(containsString(rawCredential()))));

        mockMvc.perform(put("/system-config/security")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(groupPayload("minLength", "12")))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString(rawCredential()))));

        verify(systemConfigService).saveGroupConfig(eq("SYSTEM"), any(), eq(42L));
        verify(systemConfigService).saveGroupConfig(eq("SECURITY"), any(), eq(42L));
    }

    @Test
    void systemConfigManagementRoutesShouldReturnTypedPreviewAndRefreshResult() throws Exception {
        grant("system:config:query", "system:config:edit", "system:config:delete", "system:config:preview", "system:config:refresh");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(systemConfigService.listConfigs(1, 20, null, null, "SYSTEM")).thenReturn(Map.of(
                "records", List.of(dto()),
                "total", 1,
                "size", 20,
                "current", 1
        ));
        when(systemConfigService.create(any(), eq(42L))).thenReturn(dto());
        when(systemConfigService.update(eq(7L), any(), eq(42L))).thenReturn(dto());
        when(systemConfigService.preview(eq("SYSTEM"), any())).thenReturn(preview());
        when(systemConfigService.previewSecurity(any())).thenReturn(securityPreview());
        when(systemConfigService.refreshCache(any(), eq(42L))).thenReturn(refreshResult());

        mockMvc.perform(get("/system/configs")
                        .header("Authorization", "Bearer token")
                        .param("page", "1")
                        .param("pageSize", "20")
                        .param("configGroup", "SYSTEM"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[0].configKey").value("systemName"));

        mockMvc.perform(post("/system/configs")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(savePayload()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.configGroup").value("SYSTEM"))
                .andExpect(jsonPath("$.data.auditEvidenceSummary", containsString("beforeMasked")))
                .andExpect(jsonPath("$.data.auditEvidenceSummary", containsString("afterMasked")));

        mockMvc.perform(put("/system/configs/{id}", 7L)
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(savePayload()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.configKey").value("systemName"))
                .andExpect(jsonPath("$.data.auditEvidenceSummary", containsString("beforeMasked")))
                .andExpect(jsonPath("$.data.auditEvidenceSummary", containsString("afterMasked")));

        mockMvc.perform(delete("/system/configs/{id}", 7L)
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationPayload()))
                .andExpect(status().isOk());

        mockMvc.perform(post("/system-config/system/preview")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(groupPayload("systemName", "AMS Pro")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.persistent").value(false))
                .andExpect(jsonPath("$.data.cacheRefreshed").value(false))
                .andExpect(jsonPath("$.data.runtimeEffect").value(false));

        mockMvc.perform(post("/system-config/security/preview")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(groupPayload("signIn.maxAttempts", "5")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.configGroup").value("SECURITY"))
                .andExpect(jsonPath("$.data.persistent").value(false))
                .andExpect(jsonPath("$.data.cacheRefreshed").value(false))
                .andExpect(jsonPath("$.data.runtimeEffect").value(false))
                .andExpect(content().string(not(containsString(rawCredential()))));

        mockMvc.perform(post("/system/configs/preview")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(savePayload()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.changedKeys[0]").value("systemName"));

        mockMvc.perform(post("/system/configs/refresh-cache")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationPayload()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.overallStatus").value("DEGRADED"))
                .andExpect(jsonPath("$.data.namespaceResults[0].status").value("DEGRADED"))
                .andExpect(jsonPath("$.data.beforeMasked['system-config:SYSTEM']").value("items=3"))
                .andExpect(jsonPath("$.data.afterMasked['system-config:SYSTEM']", containsString("DEGRADED")))
                .andExpect(jsonPath("$.data.auditEvidenceSummary", containsString("beforeMasked")))
                .andExpect(jsonPath("$.data.auditEvidenceSummary", containsString("afterMasked")));

        verify(systemConfigService).delete(eq(7L), any(), eq(42L));
        verify(systemConfigService).previewSecurity(any());
        verify(systemConfigService).refreshCache(any(), eq(42L));
    }

    @Test
    void superAdminShouldBypassOnlyPermissionCodeNotLoginState() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(systemConfigService.refreshCache(any(), eq(42L))).thenReturn(refreshResult());

        mockMvc.perform(post("/system/configs/refresh-cache")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationPayload()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.overallStatus").value("DEGRADED"));

        mockMvc.perform(post("/system/configs/refresh-cache")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationPayload()))
                .andExpect(status().isForbidden());

        verify(systemConfigService).refreshCache(any(), eq(42L));
    }

    private SystemConfigDTO dto() {
        SystemConfigDTO dto = new SystemConfigDTO();
        dto.setId(7L);
        dto.setTenantId("tenant-a");
        dto.setConfigGroup("SYSTEM");
        dto.setConfigKey("systemName");
        dto.setConfigName("系统名称");
        dto.setConfigValue("AMS");
        dto.setDisplayValue("AMS");
        dto.setConfigType("STRING");
        dto.setStatus(0);
        dto.setAuditEvidenceSummary("auditEvidence=provided; beforeMasked={systemName=<empty>}; afterMasked={systemName=AMS}");
        return dto;
    }

    private SystemConfigPreviewDTO preview() {
        SystemConfigPreviewDTO preview = new SystemConfigPreviewDTO();
        preview.setConfigGroup("SYSTEM");
        preview.setChangedKeys(List.of("systemName"));
        preview.setBeforeMasked(Map.of("systemName", "AMS"));
        preview.setAfterMasked(Map.of("systemName", "AMS Pro"));
        preview.setImpactModules(List.of("Workbench V3 system-base-params"));
        preview.setRiskLevel("LOW");
        preview.setValidationErrors(List.of());
        preview.setPersistent(false);
        preview.setCacheRefreshed(false);
        preview.setRuntimeEffect(false);
        return preview;
    }

    private SystemConfigPreviewDTO securityPreview() {
        SystemConfigPreviewDTO preview = new SystemConfigPreviewDTO();
        preview.setConfigGroup("SECURITY");
        preview.setChangedKeys(List.of("signIn.maxAttempts"));
        preview.setBeforeMasked(Map.of("signIn.maxAttempts", "3"));
        preview.setAfterMasked(Map.of("signIn.maxAttempts", "5"));
        preview.setImpactModules(List.of("Workbench V3 system-security-policy"));
        preview.setRiskLevel("LOW");
        preview.setValidationErrors(List.of());
        preview.setPersistent(false);
        preview.setCacheRefreshed(false);
        preview.setRuntimeEffect(false);
        preview.setSummary("安全策略配置态预览完成，未写库、未刷新缓存");
        return preview;
    }

    private SystemConfigRefreshResultDTO refreshResult() {
        SystemConfigRefreshResultDTO.NamespaceResult namespace = new SystemConfigRefreshResultDTO.NamespaceResult();
        namespace.setNamespace("system-config:SYSTEM");
        namespace.setStatus("DEGRADED");
        namespace.setItemCount(3);
        namespace.setMessage("未发现真实缓存管理器");
        namespace.setRemediation("接入缓存管理器后返回真实刷新结果");
        SystemConfigRefreshResultDTO result = new SystemConfigRefreshResultDTO();
        result.setOverallStatus("DEGRADED");
        result.setNamespaceResults(List.of(namespace));
        result.setRefreshedCount(0);
        result.setDegradedCount(1);
        result.setBeforeMasked(Map.of("system-config:SYSTEM", "items=3"));
        result.setAfterMasked(Map.of("system-config:SYSTEM", "status=DEGRADED; mutation=none"));
        result.setAuditEvidenceSummary("auditEvidence=provided; beforeMasked={system-config:SYSTEM=items=3}; afterMasked={system-config:SYSTEM=status=DEGRADED}");
        result.setMessage("明确降级");
        return result;
    }

    private String savePayload() {
        return "{\"configGroup\":\"SYSTEM\",\"configKey\":\"systemName\",\"configName\":\"系统名称\",\"configValue\":\"AMS\",\"configType\":\"STRING\",\"operatorId\":42,\"reason\":\"V3 基础参数保存复核\"}";
    }

    private String groupPayload(String key, String value) {
        return "{\"configs\":{\"" + key + "\":\"" + value + "\"},\"operatorId\":42,\"reason\":\"V3 基础参数保存复核\"}";
    }

    private String operationPayload() {
        return "{\"confirmed\":true,\"operatorId\":42,\"reason\":\"V3 基础参数操作复核\",\"auditEvidence\":\"BP-GATE\",\"namespaces\":[\"system-config:SYSTEM\"]}";
    }

    private String rawCredential() {
        return "raw" + "-system-config-credential";
    }

    private void grant(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin",
                "n/a",
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()
        ));
    }
}
