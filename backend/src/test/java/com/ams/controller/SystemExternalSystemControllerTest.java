package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.SystemExternalSystemDTO;
import com.ams.dto.SystemExternalSystemValidationResultDTO;
import com.ams.service.SystemExternalSystemService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class SystemExternalSystemControllerTest {

    @Mock
    private SystemExternalSystemService externalSystemService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new SystemExternalSystemController(externalSystemService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void listAndDetailShouldExposeOnlyMaskedExternalSystemData() throws Exception {
        grant("system:integration:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(externalSystemService.list("ERP", "ERP", "ENABLED")).thenReturn(List.of(response()));
        when(externalSystemService.get(7L)).thenReturn(response());

        mockMvc.perform(get("/system/external-systems")
                        .header("Authorization", "Bearer token")
                        .param("keyword", "ERP")
                        .param("systemType", "ERP")
                        .param("status", "ENABLED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].systemCode").value("ERP_CORE"))
                .andExpect(jsonPath("$.data[0].maskedSecretSummary").value("2 项认证材料已脱敏"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString(rawCredential()))));

        mockMvc.perform(get("/system/external-systems/{id}", 7L)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.maskedBaseUrl").value("https://erp.example.com/api"));

        verify(externalSystemService).list("ERP", "ERP", "ENABLED");
        verify(externalSystemService).get(7L);
    }

    @Test
    void shouldRejectMissingBearerTokenMissingUserAndMissingAuthentication() throws Exception {
        mockMvc.perform(get("/system/external-systems"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        when(jwtUtil.getUserIdFromToken("token")).thenReturn(null);
        grant("system:integration:query");
        mockMvc.perform(get("/system/external-systems")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        SecurityContextHolder.clearContext();
        when(jwtUtil.getUserIdFromToken("token2")).thenReturn(42L);
        mockMvc.perform(get("/system/external-systems")
                        .header("Authorization", "Bearer token2"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(externalSystemService);
    }

    @Test
    void shouldRejectAuthenticatedUserWithoutEndpointPermission() throws Exception {
        grant("system:integration:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(post("/system/external-systems")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(savePayload()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(externalSystemService);
    }

    @Test
    void createUpdateEnableDisableAndValidateShouldUseDedicatedV3Endpoints() throws Exception {
        grant("system:integration:edit", "system:integration:test");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(externalSystemService.create(any(), eq(42L))).thenReturn(response());
        when(externalSystemService.update(eq(7L), any(), eq(42L))).thenReturn(response());
        when(externalSystemService.enable(eq(7L), any(), eq(42L))).thenReturn(response());
        when(externalSystemService.disable(eq(7L), any(), eq(42L))).thenReturn(response());
        when(externalSystemService.validateConfig(eq(7L), any(), eq(42L))).thenReturn(validationResult());

        mockMvc.perform(post("/system/external-systems")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(savePayload()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.authConfigured").value(true))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString(rawCredential()))));

        mockMvc.perform(put("/system/external-systems/{id}", 7L)
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(savePayload()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.systemCode").value("ERP_CORE"));

        mockMvc.perform(post("/system/external-systems/{id}/enable", 7L)
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationPayload()))
                .andExpect(status().isOk());

        mockMvc.perform(post("/system/external-systems/{id}/disable", 7L)
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationPayload()))
                .andExpect(status().isOk());

        mockMvc.perform(post("/system/external-systems/{id}/validate", 7L)
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationPayload()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.configOnly").value(true))
                .andExpect(jsonPath("$.data.noRealExternalCall").value(true))
                .andExpect(jsonPath("$.data.message").value("外部系统配置校验通过，未触发真实外部调用"));

        verify(externalSystemService).create(any(), eq(42L));
        verify(externalSystemService).update(eq(7L), any(), eq(42L));
        verify(externalSystemService).enable(eq(7L), any(), eq(42L));
        verify(externalSystemService).disable(eq(7L), any(), eq(42L));
        verify(externalSystemService).validateConfig(eq(7L), any(), eq(42L));
    }

    @Test
    void superAdminShouldBypassOnlyPermissionCodeNotLoginState() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(externalSystemService.validateConfig(eq(7L), any(), eq(42L))).thenReturn(validationResult());

        mockMvc.perform(post("/system/external-systems/{id}/validate", 7L)
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationPayload()))
                .andExpect(status().isOk());

        mockMvc.perform(post("/system/external-systems/{id}/validate", 7L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationPayload()))
                .andExpect(status().isForbidden());

        verify(externalSystemService).validateConfig(eq(7L), any(), eq(42L));
    }

    private SystemExternalSystemDTO response() {
        SystemExternalSystemDTO response = new SystemExternalSystemDTO();
        response.setId(7L);
        response.setTenantId("tenant-a");
        response.setSystemCode("ERP_CORE");
        response.setSystemName("ERP Core");
        response.setSystemType("ERP");
        response.setMaskedBaseUrl("https://erp.example.com/api");
        response.setAuthType("API_KEY");
        response.setAuthConfigured(true);
        response.setConfigMasked(true);
        response.setMaskedSecretSummary("2 项认证材料已脱敏");
        response.setEnabled(true);
        response.setStatus("ENABLED");
        return response;
    }

    private SystemExternalSystemValidationResultDTO validationResult() {
        SystemExternalSystemValidationResultDTO result = new SystemExternalSystemValidationResultDTO();
        result.setSystemId(7L);
        result.setSystemCode("ERP_CORE");
        result.setValid(true);
        result.setConfigOnly(true);
        result.setNoRealExternalCall(true);
        result.setTargetSummary("https://erp.example.com/api");
        result.setMessage("外部系统配置校验通过，未触发真实外部调用");
        return result;
    }

    private String savePayload() {
        return "{\"systemCode\":\"ERP_CORE\",\"systemName\":\"ERP Core\",\"systemType\":\"ERP\",\"baseUrl\":\"https://erp.example.com/api?ticket="
                + rawCredential()
                + "\",\"authType\":\"API_KEY\",\"authConfig\":{\"apiKey\":\""
                + rawCredential()
                + "\"},\"operatorId\":42,\"reason\":\"V3 保存复核\"}";
    }

    private String operationPayload() {
        return "{\"confirmed\":true,\"operatorId\":42,\"reason\":\"V3 操作复核\",\"auditEvidence\":\"ES-GATE\"}";
    }

    private String rawCredential() {
        return "raw" + "-external-credential";
    }

    private void grant(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin",
                "n/a",
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()
        ));
    }
}
