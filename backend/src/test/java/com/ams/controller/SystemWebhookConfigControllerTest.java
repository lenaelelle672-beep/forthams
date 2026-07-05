package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.SystemWebhookConfigResponse;
import com.ams.dto.SystemWebhookConfigTestResponse;
import com.ams.service.SystemWebhookConfigService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class SystemWebhookConfigControllerTest {

    @Mock
    private SystemWebhookConfigService webhookConfigService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new SystemWebhookConfigController(webhookConfigService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void listShouldRequireQueryPermissionAndExposeV3Route() throws Exception {
        grant("system:integration:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(webhookConfigService.list()).thenReturn(List.of(response()));

        mockMvc.perform(get("/system/webhook-configs")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].configName").value("Webhook 资产同步"))
                .andExpect(jsonPath("$.data[0].maskedTargetUrl").value("https://hooks.example.com/asset/sync"));

        verify(webhookConfigService).list();
    }

    @Test
    void queryShouldRejectMissingBearerToken() throws Exception {
        mockMvc.perform(get("/system/webhook-configs"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    void queryShouldRejectBearerTokenWithoutSecurityAuthority() throws Exception {
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(get("/system/webhook-configs")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(webhookConfigService);
    }

    @Test
    void createAndUpdateShouldUseEditGuardAndService() throws Exception {
        grant("system:integration:edit");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(webhookConfigService.create(any())).thenReturn(response());
        when(webhookConfigService.update(eq(7L), any())).thenReturn(response());

        String payload = "{\"configName\":\"Webhook 资产同步\",\"eventType\":\"ASSET_SYNC\",\"targetUrl\":\"https://hooks.example.com/asset/sync\",\"signingStrategy\":\"HMAC_SHA256\",\"signingSecret\":\"raw\"}";

        mockMvc.perform(post("/system/webhook-configs")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.secretConfigured").value(true));

        mockMvc.perform(put("/system/webhook-configs/{id}", 7L)
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.configName").value("Webhook 资产同步"));

        verify(webhookConfigService).create(any());
        verify(webhookConfigService).update(eq(7L), any());
    }

    @Test
    void statusDeleteAndTestShouldMapToDedicatedEndpoints() throws Exception {
        grant("system:integration:edit", "system:integration:delete", "system:integration:test");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(webhookConfigService.updateStatus(7L, false)).thenReturn(response());

        SystemWebhookConfigTestResponse testResponse = new SystemWebhookConfigTestResponse();
        testResponse.setConfigId(7L);
        testResponse.setValid(true);
        testResponse.setConfigOnly(true);
        testResponse.setMessage("Webhook 配置校验通过，未触发真实外部调用");
        when(webhookConfigService.testConfig(7L)).thenReturn(testResponse);

        mockMvc.perform(put("/system/webhook-configs/{id}/status", 7L)
                        .header("Authorization", "Bearer token")
                        .param("enabled", "false"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.maskedTargetUrl").value("https://hooks.example.com/asset/sync"));

        mockMvc.perform(post("/system/webhook-configs/{id}/test", 7L)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.configOnly").value(true));

        mockMvc.perform(delete("/system/webhook-configs/{id}", 7L)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(webhookConfigService).updateStatus(7L, false);
        verify(webhookConfigService).testConfig(7L);
        verify(webhookConfigService).delete(7L);
    }

    @Test
    void deleteShouldRejectAuthenticatedUserWithoutDeletePermission() throws Exception {
        grant("system:integration:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(delete("/system/webhook-configs/{id}", 7L)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(webhookConfigService);
    }

    @Test
    void superAdminRoleShouldAllowAllWebhookConfigOperations() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(webhookConfigService.testConfig(7L)).thenReturn(new SystemWebhookConfigTestResponse());

        mockMvc.perform(post("/system/webhook-configs/{id}/test", 7L)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk());

        verify(webhookConfigService).testConfig(7L);
    }

    @Test
    void testShouldRejectMissingBearerToken() throws Exception {
        mockMvc.perform(post("/system/webhook-configs/{id}/test", 7L))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    private SystemWebhookConfigResponse response() {
        SystemWebhookConfigResponse response = new SystemWebhookConfigResponse();
        response.setId(7L);
        response.setConfigName("Webhook 资产同步");
        response.setEventType("ASSET_SYNC");
        response.setMaskedTargetUrl("https://hooks.example.com/asset/sync");
        response.setEnabled(true);
        response.setStatus("ENABLED");
        response.setSecretConfigured(true);
        response.setSignatureConfigured(true);
        response.setSigningStrategy("HMAC_SHA256");
        return response;
    }

    private void grant(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin",
                "n/a",
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()
        ));
    }
}
