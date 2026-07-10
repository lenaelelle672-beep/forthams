package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.WorkflowMailConfigDTO;
import com.ams.service.WorkflowMailConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class WorkflowMailConfigControllerTest {

    @Mock
    private WorkflowMailConfigService workflowMailConfigService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new WorkflowMailConfigController(workflowMailConfigService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listShouldReturnConfigs() throws Exception {
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

        mockMvc.perform(get("/system/workflow-mail"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.records[0].businessType").value("ASSET_TRANSFER"))
                .andExpect(jsonPath("$.data.records[0].triggerEventLabel").value("审批时"));
    }

    @Test
    void detailShouldReturnConfigById() throws Exception {
        WorkflowMailConfigDTO cfg = new WorkflowMailConfigDTO();
        cfg.setId(5L);
        cfg.setBusinessType("MAINTENANCE");
        cfg.setRiskNote("零业务调用风险");
        when(workflowMailConfigService.detail(5L)).thenReturn(cfg);

        mockMvc.perform(get("/system/workflow-mail/5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(5))
                .andExpect(jsonPath("$.data.riskNote").value("零业务调用风险"));
    }

    @Test
    void metaShouldReturnReadOnlyNotice() throws Exception {
        WorkflowMailConfigDTO.Meta meta = new WorkflowMailConfigDTO.Meta();
        meta.setTriggerEvents(List.of("ON_APPROVAL"));
        meta.setReadOnlyNotice("只读");
        when(workflowMailConfigService.meta()).thenReturn(meta);

        mockMvc.perform(get("/system/workflow-mail/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.triggerEvents[0]").value("ON_APPROVAL"));
    }
}
