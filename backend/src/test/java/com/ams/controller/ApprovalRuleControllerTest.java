package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.ApprovalRuleConflictDTO;
import com.ams.dto.ApprovalRuleDTO;
import com.ams.dto.ApprovalRuleSimulationResultDTO;
import com.ams.service.ApprovalRuleService;
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
class ApprovalRuleControllerTest {

    @Mock
    private ApprovalRuleService approvalRuleService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new ApprovalRuleController(approvalRuleService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldExposeListDetailCreateUpdateEnableDisableSimulateAndConflicts() throws Exception {
        grant("workflow:approval-rule:list", "workflow:approval-rule:create", "workflow:approval-rule:update", "workflow:approval-rule:enable", "workflow:approval-rule:disable", "workflow:approval-rule:test");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(approvalRuleService.listRules(eq("PROC"), eq("NODE"), eq("ACTIVE"), eq("金额"))).thenReturn(List.of(rule("ACTIVE")));
        when(approvalRuleService.getRule(7L)).thenReturn(rule("ACTIVE"));
        when(approvalRuleService.createRule(any())).thenReturn(rule("DISABLED"));
        when(approvalRuleService.updateRule(eq(7L), any())).thenReturn(rule("DISABLED"));
        when(approvalRuleService.enableRule(eq(7L), any())).thenReturn(rule("ACTIVE"));
        when(approvalRuleService.disableRule(eq(7L), any())).thenReturn(rule("DISABLED"));
        ApprovalRuleSimulationResultDTO simulation = new ApprovalRuleSimulationResultDTO();
        simulation.setMatchedRuleIds(List.of(7L));
        simulation.setSafeExplanation("白名单表达式本地解析完成");
        when(approvalRuleService.simulate(any())).thenReturn(simulation);
        ApprovalRuleConflictDTO conflict = new ApprovalRuleConflictDTO();
        conflict.setConflictSummary("同一流程/节点/优先级存在重叠条件");
        when(approvalRuleService.detectConflicts(any())).thenReturn(List.of(conflict));

        mockMvc.perform(get("/approval-rules?processKey=PROC&nodeKey=NODE&status=ACTIVE&keyword=金额").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].conditionSummary").value("amount >= 1000"));
        mockMvc.perform(get("/approval-rules/7").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(7));
        mockMvc.perform(post("/approval-rules").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(saveJson(42L)))
                .andExpect(status().isOk());
        mockMvc.perform(put("/approval-rules/7").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(saveJson(42L)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/approval-rules/7/enable").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(operationJson(42L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
        mockMvc.perform(post("/approval-rules/7/disable").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(operationJson(42L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DISABLED"));
        mockMvc.perform(post("/approval-rules/simulate").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(simulationJson(42L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.matchedRuleIds[0]").value(7));
        mockMvc.perform(post("/approval-rules/conflicts").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(simulationJson(42L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].conflictSummary").value("同一流程/节点/优先级存在重叠条件"));

        ArgumentCaptor<com.ams.dto.ApprovalRuleSaveDTO> createCaptor = ArgumentCaptor.forClass(com.ams.dto.ApprovalRuleSaveDTO.class);
        verify(approvalRuleService).createRule(createCaptor.capture());
        assertEquals(42L, createCaptor.getValue().getOperatorId());
    }

    @Test
    void shouldRejectMissingBearerUserAuthenticationPermissionAndOperatorMismatchBeforeService() throws Exception {
        mockMvc.perform(get("/approval-rules"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        grant("workflow:approval-rule:list");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(null);
        mockMvc.perform(get("/approval-rules").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        SecurityContextHolder.clearContext();
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        mockMvc.perform(get("/approval-rules").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        grant("workflow:approval-rule:list");
        mockMvc.perform(post("/approval-rules").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(saveJson(42L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        grant("workflow:approval-rule:create");
        mockMvc.perform(post("/approval-rules").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(saveJson(99L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500));

        verifyNoInteractions(approvalRuleService);
    }

    @Test
    void superAdminShouldBypassOnlyPermissionCodeButNotLoginOrAuditPayload() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(99L);
        when(approvalRuleService.enableRule(eq(7L), any())).thenReturn(rule("ACTIVE"));

        mockMvc.perform(post("/approval-rules/7/enable").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content(operationJson(99L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));

        mockMvc.perform(post("/approval-rules/7/enable").contentType(MediaType.APPLICATION_JSON).content(operationJson(99L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        mockMvc.perform(post("/approval-rules/7/disable").header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content("{\"confirmed\":true,\"operatorId\":99}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500));
    }

    private ApprovalRuleDTO rule(String status) {
        ApprovalRuleDTO dto = new ApprovalRuleDTO();
        dto.setId(7L);
        dto.setProcessKey("PROC");
        dto.setNodeKey("NODE");
        dto.setRuleName("大额审批规则");
        dto.setPriority(10);
        dto.setConditionSummary("amount >= 1000");
        dto.setApproverSummary("候选处理人策略：ROLE_MANAGER");
        dto.setStatus(status);
        return dto;
    }

    private String saveJson(Long operatorId) {
        return "{\"processKey\":\"PROC\",\"businessType\":\"ASSET\",\"nodeKey\":\"NODE\",\"ruleName\":\"大额审批规则\",\"priority\":10,\"conditionExpression\":\"amount >= 1000 AND applicantRole == 'MANAGER'\",\"approverStrategy\":\"ROLE_MANAGER\",\"operatorId\":" + operatorId + ",\"reason\":\"Day5 审批规则保存复核\"}";
    }

    private String operationJson(Long operatorId) {
        return "{\"confirmed\":true,\"operatorId\":" + operatorId + ",\"reason\":\"启停复核通过\",\"auditEvidence\":\"APPROVAL_RULE_GATE\"}";
    }

    private String simulationJson(Long operatorId) {
        return "{\"processKey\":\"PROC\",\"businessType\":\"ASSET\",\"nodeKey\":\"NODE\",\"context\":{\"amount\":1200,\"applicantRole\":\"MANAGER\"},\"operatorId\":" + operatorId + ",\"reason\":\"模拟复核\"}";
    }

    private void grant(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin",
                "n/a",
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()
        ));
    }
}
