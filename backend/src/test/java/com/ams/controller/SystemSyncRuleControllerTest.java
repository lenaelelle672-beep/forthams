package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.SystemSyncQueueSummaryResponse;
import com.ams.dto.SystemSyncRuleResponse;
import com.ams.service.SystemSyncExecutionService;
import com.ams.service.SystemSyncRuleService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class SystemSyncRuleControllerTest {

    @Mock
    private SystemSyncRuleService syncRuleService;

    @Mock
    private SystemSyncExecutionService executionService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new SystemSyncRuleController(syncRuleService, executionService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listShouldExposeV3SyncRulesEndpoint() throws Exception {
        when(syncRuleService.list()).thenReturn(List.of(response()));

        mockMvc.perform(get("/system/sync-rules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].ruleName").value("资产同步规则"));
    }

    @Test
    void createShouldRequireBearerUserAndUseDedicatedService() throws Exception {
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(syncRuleService.create(any())).thenReturn(response());

        mockMvc.perform(post("/system/sync-rules")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"interfaceId\":7,\"ruleName\":\"资产同步规则\",\"triggerType\":\"manual\",\"retryCount\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.ruleName").value("资产同步规则"));

        verify(syncRuleService).create(any());
    }

    @Test
    void createShouldRejectMissingBearerToken() throws Exception {
        mockMvc.perform(post("/system/sync-rules")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"interfaceId\":7}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    void queueSummaryShouldBeReadOnlyEndpoint() throws Exception {
        SystemSyncQueueSummaryResponse summary = new SystemSyncQueueSummaryResponse();
        summary.setQueueConsumptionEnabled(false);
        summary.setMode("READ_ONLY_SUMMARY");
        when(executionService.queueSummary()).thenReturn(summary);

        mockMvc.perform(get("/system/sync-rules/queue/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.queueConsumptionEnabled").value(false))
                .andExpect(jsonPath("$.data.mode").value("READ_ONLY_SUMMARY"));
    }

    private SystemSyncRuleResponse response() {
        SystemSyncRuleResponse response = new SystemSyncRuleResponse();
        response.setId(9L);
        response.setInterfaceId(7L);
        response.setRuleName("资产同步规则");
        response.setTriggerType("MANUAL");
        response.setEnabled(true);
        return response;
    }
}
