package com.ams.controller;

import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowStatusUpdateDTO;
import com.ams.service.WorkflowDefinitionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("WorkflowDefinition Controller Tests")
class WorkflowDefinitionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private WorkflowDefinitionService workflowDefinitionService;

    @Test
    @DisplayName("Should return list of workflow definitions")
    void testList() throws Exception {
        WorkflowDefinitionDTO dto = new WorkflowDefinitionDTO();
        dto.setBusinessType("RETIREMENT");
        dto.setName("资产退役流程");

        when(workflowDefinitionService.listDefinitions()).thenReturn(List.of(dto));

        mockMvc.perform(get("/workflows")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data").isArray())
            .andExpect(jsonPath("$.data.length()").value(1));

        verify(workflowDefinitionService).listDefinitions();
    }

    @Test
    @DisplayName("Should return workflow definition by business type")
    void testGet() throws Exception {
        WorkflowDefinitionDTO dto = new WorkflowDefinitionDTO();
        dto.setBusinessType("RETIREMENT");
        dto.setName("资产退役流程");
        dto.setStatus("PUBLISHED");

        when(workflowDefinitionService.getDefinition("RETIREMENT")).thenReturn(dto);

        mockMvc.perform(get("/workflows/{businessType}", "RETIREMENT")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.businessType").value("RETIREMENT"));

        verify(workflowDefinitionService).getDefinition("RETIREMENT");
    }

    @Test
    @WithMockUser(roles = "SUPER_ADMIN")
    @DisplayName("Should save draft workflow successfully")
    void testSaveDraft() throws Exception {
        WorkflowDefinitionSaveDTO saveDTO = new WorkflowDefinitionSaveDTO();
        saveDTO.setName("Test Flow");
        saveDTO.setDescription("Test description");

        WorkflowDefinitionDTO result = new WorkflowDefinitionDTO();
        result.setBusinessType("RETIREMENT");
        result.setStatus("DRAFT");

        when(workflowDefinitionService.saveDraft(eq("RETIREMENT"), any(WorkflowDefinitionSaveDTO.class))).thenReturn(result);

        mockMvc.perform(put("/workflows/{businessType}/draft", "RETIREMENT")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(saveDTO)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(workflowDefinitionService).saveDraft(eq("RETIREMENT"), any(WorkflowDefinitionSaveDTO.class));
    }

    @Test
    @WithMockUser(roles = "SUPER_ADMIN")
    @DisplayName("Should publish workflow successfully")
    void testPublish() throws Exception {
        WorkflowDefinitionDTO result = new WorkflowDefinitionDTO();
        result.setBusinessType("RETIREMENT");
        result.setStatus("PUBLISHED");

        when(workflowDefinitionService.publish(eq("RETIREMENT"), any())).thenReturn(result);

        mockMvc.perform(post("/workflows/{businessType}/publish", "RETIREMENT")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(workflowDefinitionService).publish(eq("RETIREMENT"), any());
    }

    @Test
    @WithMockUser(roles = "SUPER_ADMIN")
    @DisplayName("Should update workflow status successfully")
    void testUpdateStatus() throws Exception {
        WorkflowStatusUpdateDTO statusDTO = new WorkflowStatusUpdateDTO();
        statusDTO.setStatus("ENABLED");
        statusDTO.setOperatorId(1L);

        WorkflowDefinitionDTO result = new WorkflowDefinitionDTO();
        result.setBusinessType("RETIREMENT");
        result.setStatus("PUBLISHED");

        when(workflowDefinitionService.updateStatus(eq("RETIREMENT"), any(WorkflowStatusUpdateDTO.class))).thenReturn(result);

        mockMvc.perform(post("/workflows/{businessType}/status", "RETIREMENT")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(statusDTO)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(workflowDefinitionService).updateStatus(eq("RETIREMENT"), any(WorkflowStatusUpdateDTO.class));
    }
}
