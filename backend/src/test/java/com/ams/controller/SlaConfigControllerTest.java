package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.SlaConfigDTO;
import com.ams.dto.SlaConfigSimulationResultDTO;
import com.ams.dto.SlaRuntimeSummaryDTO;
import com.ams.dto.SlaTimeoutExportDTO;
import com.ams.dto.SlaTimeoutRecordDTO;
import com.ams.service.SlaConfigService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class SlaConfigControllerTest {

    @Mock
    private SlaConfigService slaConfigService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new SlaConfigController(slaConfigService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldExposeLegacyAndDay6Endpoints() throws Exception {
        grant("workflow:sla:list", "workflow:sla:update", "workflow:sla:enable", "workflow:sla:disable", "workflow:sla:test", "workflow:sla:export", "system:runtime:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(slaConfigService.listConfigs(eq("ASSET_APPROVAL"), eq(null), eq("ACTIVE"), eq(null))).thenReturn(List.of(config("ACTIVE")));
        when(slaConfigService.getConfig(7L)).thenReturn(config("ACTIVE"));
        when(slaConfigService.updateConfig(eq(7L), any())).thenReturn(config("ACTIVE"));
        when(slaConfigService.enableConfig(eq(7L), any())).thenReturn(config("ACTIVE"));
        when(slaConfigService.disableConfig(eq(7L), any())).thenReturn(config("DISABLED"));
        when(slaConfigService.simulate(any())).thenReturn(simulation());
        when(slaConfigService.runtimeSummary()).thenReturn(summary());
        when(slaConfigService.listTimeoutRecords(eq("ASSET_APPROVAL"), eq("MANAGER_REVIEW"), eq("OPEN"), eq("HIGH"))).thenReturn(List.of(timeoutRecord()));
        when(slaConfigService.exportTimeoutRecords(any())).thenReturn(exportResult());

        mockMvc.perform(get("/sla-config?processKey=ASSET_APPROVAL&status=ACTIVE").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].priority").value("HIGH"));
        mockMvc.perform(get("/sla-config/7").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(7));
        mockMvc.perform(put("/sla-config/7").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content("{\"responseHours\":2,\"resolveHours\":8,\"warningRatio\":0.75,\"status\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value(1));
        mockMvc.perform(post("/sla-config/7/enable").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(operationJson(42L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.statusText").value("ACTIVE"));
        mockMvc.perform(post("/sla-config/7/disable").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(operationJson(42L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.statusText").value("DISABLED"));
        mockMvc.perform(post("/sla-config/simulate").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(simulationJson(42L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.matchedConfigId").value(7));
        mockMvc.perform(get("/sla-config/runtime-summary").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.readOnly").value(true));
        mockMvc.perform(get("/sla-config/timeout-records?processKey=ASSET_APPROVAL&nodeKey=MANAGER_REVIEW&status=OPEN&riskLevel=HIGH").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].masked").value(true));
        mockMvc.perform(post("/sla-config/export").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(exportJson(42L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.masked").value(true));

        ArgumentCaptor<com.ams.dto.SlaConfigSaveDTO> updateCaptor = ArgumentCaptor.forClass(com.ams.dto.SlaConfigSaveDTO.class);
        verify(slaConfigService).updateConfig(eq(7L), updateCaptor.capture());
        assertEquals(42L, updateCaptor.getValue().getOperatorId());
        assertEquals("SLA_CONFIG_LEGACY_UPDATE", updateCaptor.getValue().getAuditEvidence());
    }

    @Test
    void shouldRejectMissingBearerAuthenticationPermissionAndAuditBeforeService() throws Exception {
        mockMvc.perform(get("/sla-config"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        grant("workflow:sla:list");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(null);
        mockMvc.perform(get("/sla-config").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        SecurityContextHolder.clearContext();
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        mockMvc.perform(get("/sla-config").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        grant("workflow:sla:list");
        mockMvc.perform(post("/sla-config/7/enable").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(operationJson(42L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        grant("workflow:sla:enable");
        mockMvc.perform(post("/sla-config/7/enable").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content("{\"confirmed\":true,\"operatorId\":99,\"reason\":\"错人\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));

        grant("workflow:sla:test");
        mockMvc.perform(post("/sla-config/simulate").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content("{\"processKey\":\"ASSET_APPROVAL\",\"nodeKey\":\"MANAGER_REVIEW\",\"operatorId\":42,\"reason\":\"缺确认\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));

        verifyNoInteractions(slaConfigService);
    }

    @Test
    void superAdminShouldBypassOnlyPermissionCodeButNotLoginOrAuditPayload() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(99L);
        when(slaConfigService.enableConfig(eq(7L), any())).thenReturn(config("ACTIVE"));

        mockMvc.perform(post("/sla-config/7/enable").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(operationJson(99L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.statusText").value("ACTIVE"));

        mockMvc.perform(post("/sla-config/7/enable").contentType(MediaType.APPLICATION_JSON).content(operationJson(99L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        mockMvc.perform(post("/sla-config/export").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content("{\"confirmed\":true,\"operatorId\":99}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    private SlaConfigDTO config(String statusText) {
        SlaConfigDTO dto = new SlaConfigDTO();
        dto.setId(7L);
        dto.setProcessKey("ASSET_APPROVAL");
        dto.setNodeKey("MANAGER_REVIEW");
        dto.setPriority("HIGH");
        dto.setResponseHours(2);
        dto.setResolveHours(8);
        dto.setWarningRatio(0.75D);
        dto.setStatus("ACTIVE".equals(statusText) ? 1 : 0);
        dto.setStatusText(statusText);
        dto.setEnabled("ACTIVE".equals(statusText));
        return dto;
    }

    private SlaConfigSimulationResultDTO simulation() {
        SlaConfigSimulationResultDTO dto = new SlaConfigSimulationResultDTO();
        dto.setMatchedConfigId(7L);
        dto.setSafeExplanation("只读模拟完成，未发送真实通知");
        dto.setTenantScoped(true);
        return dto;
    }

    private SlaRuntimeSummaryDTO summary() {
        SlaRuntimeSummaryDTO dto = new SlaRuntimeSummaryDTO();
        dto.setReadOnly(true);
        dto.setTenantScoped(true);
        dto.setOverdueCount(1);
        return dto;
    }

    private SlaTimeoutRecordDTO timeoutRecord() {
        SlaTimeoutRecordDTO dto = new SlaTimeoutRecordDTO();
        dto.setId(10L);
        dto.setMasked(true);
        dto.setMaskedBusinessSummary("业务摘要已脱敏");
        return dto;
    }

    private SlaTimeoutExportDTO exportResult() {
        SlaTimeoutExportDTO dto = new SlaTimeoutExportDTO();
        dto.setMasked(true);
        dto.setRecordCount(1);
        return dto;
    }

    private String operationJson(Long operatorId) {
        return "{\"confirmed\":true,\"operatorId\":" + operatorId + ",\"reason\":\"SLA启停复核\",\"auditEvidence\":\"SLA_GATE\"}";
    }

    private String simulationJson(Long operatorId) {
        return "{\"processKey\":\"ASSET_APPROVAL\",\"businessType\":\"ASSET\",\"nodeKey\":\"MANAGER_REVIEW\",\"priority\":\"HIGH\",\"confirmed\":true,\"variables\":{\"amount\":1200},\"operatorId\":" + operatorId + ",\"reason\":\"SLA模拟复核\"}";
    }

    private String exportJson(Long operatorId) {
        return "{\"processKey\":\"ASSET_APPROVAL\",\"confirmed\":true,\"operatorId\":" + operatorId + ",\"reason\":\"导出复核\",\"auditEvidence\":\"SLA_EXPORT_GATE\"}";
    }

    private void grant(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin",
                "n/a",
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()
        ));
    }
}
