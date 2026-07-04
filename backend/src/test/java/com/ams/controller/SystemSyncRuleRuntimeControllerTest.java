package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.SystemSyncRunLogResponse;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class SystemSyncRuleRuntimeControllerTest {

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
    void dryRunShouldUseDedicatedDryRunEndpoint() throws Exception {
        SystemSyncRunLogResponse log = new SystemSyncRunLogResponse();
        log.setId(11L);
        log.setDryRun(true);
        log.setExecutionMode("DRY_RUN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(executionService.dryRunRule(eq(9L), any())).thenReturn(log);

        mockMvc.perform(post("/system/sync-rules/{id}/dry-run", 9L)
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"triggerSource\":\"manual\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.dryRun").value(true))
                .andExpect(jsonPath("$.data.executionMode").value("DRY_RUN"));

        verify(executionService).dryRunRule(eq(9L), any());
    }

    @Test
    void retryLogShouldOnlyExposeSingleLogRetryEndpoint() throws Exception {
        SystemSyncRunLogResponse log = new SystemSyncRunLogResponse();
        log.setId(11L);
        log.setStatus("FAILED");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(executionService.retryLog(11L)).thenReturn(log);

        mockMvc.perform(post("/system/sync-rules/logs/{logId}/retry", 11L)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("FAILED"));

        verify(executionService).retryLog(eq(11L));
    }

    @Test
    void dryRunShouldRejectMissingBearerToken() throws Exception {
        mockMvc.perform(post("/system/sync-rules/{id}/dry-run", 9L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }
}
