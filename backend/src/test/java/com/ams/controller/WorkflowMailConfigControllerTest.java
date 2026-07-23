package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.WorkflowMailConfigDTO;
import com.ams.service.WorkflowMailConfigService;
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
class WorkflowMailConfigControllerTest {

    @Mock
    private WorkflowMailConfigService workflowMailConfigService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new WorkflowMailConfigController(workflowMailConfigService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void listShouldReturnConfigs() throws Exception {
        grant("mail:workflow:query");
        WorkflowMailConfigDTO.PageResult page = new WorkflowMailConfigDTO.PageResult();
        page.setTotal(1);
        WorkflowMailConfigDTO cfg = new WorkflowMailConfigDTO();
        cfg.setId(1L);
        cfg.setBusinessType("ASSET_TRANSFER");
        cfg.setNodeKey("approval");
        cfg.setTriggerEvent("ON_APPROVAL");
        cfg.setTriggerEventLabel("审批时");
        cfg.setEnabled(true);
        page.setRecords(List.of(cfg));
        when(workflowMailConfigService.list(null, null, 1, 20)).thenReturn(page);

        mockMvc.perform(get("/system/workflow-mail").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.records[0].businessType").value("ASSET_TRANSFER"))
                .andExpect(jsonPath("$.data.records[0].triggerEventLabel").value("审批时"));
    }

    @Test
    void detailShouldReturnConfigById() throws Exception {
        grant("mail:workflow:query");
        WorkflowMailConfigDTO cfg = new WorkflowMailConfigDTO();
        cfg.setId(5L);
        cfg.setBusinessType("MAINTENANCE");
        cfg.setRiskNote("零业务调用风险");
        when(workflowMailConfigService.detail(5L)).thenReturn(cfg);

        mockMvc.perform(get("/system/workflow-mail/5").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(5))
                .andExpect(jsonPath("$.data.riskNote").value("零业务调用风险"));
    }

    @Test
    void metaShouldReturnReadOnlyNotice() throws Exception {
        grant("mail:workflow:query");
        WorkflowMailConfigDTO.Meta meta = new WorkflowMailConfigDTO.Meta();
        meta.setTriggerEvents(List.of("ON_APPROVAL"));
        meta.setReadOnlyNotice("只读");
        when(workflowMailConfigService.meta()).thenReturn(meta);

        mockMvc.perform(get("/system/workflow-mail/meta").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.triggerEvents[0]").value("ON_APPROVAL"));
    }

    private void grant(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin",
                "n/a",
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()
        ));
    }
}
