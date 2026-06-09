package com.ams.controller;

import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowStatusUpdateDTO;
import com.ams.security.LoginUser;
import com.ams.service.WorkflowDefinitionService;
import com.ams.utils.JwtUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
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

    @MockBean
    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        when(jwtUtil.getUserIdFromToken("test-token")).thenReturn(1L);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Should protect workflow definition endpoints with RuoYi permission expressions")
    void shouldUseRuoYiPermissionExpressions() throws Exception {
        Map<String, String> expected = Map.of(
                "list", "@ss.hasPermi('workflow:definition:query')",
                "get", "@ss.hasPermi('workflow:definition:query')",
                "saveDraft", "@ss.hasPermi('workflow:definition:edit')",
                "publish", "@ss.hasPermi('workflow:definition:edit')",
                "updateStatus", "@ss.hasPermi('workflow:definition:edit')",
                "createCustomDefinition", "@ss.hasPermi('workflow:definition:edit')",
                "deleteDefinition", "@ss.hasPermi('workflow:definition:edit')");

        for (Map.Entry<String, String> entry : expected.entrySet()) {
            Method method = findMethod(entry.getKey());
            PreAuthorize preAuthorize = method.getAnnotation(PreAuthorize.class);
            assertNotNull(preAuthorize, entry.getKey() + " should declare @PreAuthorize");
            assertEquals(entry.getValue(), preAuthorize.value());
        }
    }

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
        saveDTO.setDefinition(java.util.Map.of("id", "WF-TEST", "nodes", java.util.List.of(), "edges", java.util.List.of()));

        WorkflowDefinitionDTO result = new WorkflowDefinitionDTO();
        result.setBusinessType("RETIREMENT");
        result.setStatus("DRAFT");

        when(workflowDefinitionService.saveDraft(eq("RETIREMENT"), any(WorkflowDefinitionSaveDTO.class), anyLong())).thenReturn(result);

        mockMvc.perform(put("/workflows/{businessType}/draft", "RETIREMENT")
                .header("Authorization", "Bearer test-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(saveDTO)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(workflowDefinitionService).saveDraft(eq("RETIREMENT"), any(WorkflowDefinitionSaveDTO.class), anyLong());
    }

    @Test
    @DisplayName("Should save draft using authenticated LoginUser without reparsing Authorization header")
    void testSaveDraftWithLoginUserPrincipal() throws Exception {
        WorkflowDefinitionSaveDTO saveDTO = new WorkflowDefinitionSaveDTO();
        saveDTO.setName("Test Flow");
        saveDTO.setDescription("Test description");
        saveDTO.setDefinition(java.util.Map.of("id", "WF-TEST", "nodes", java.util.List.of(), "edges", java.util.List.of()));

        WorkflowDefinitionDTO result = new WorkflowDefinitionDTO();
        result.setBusinessType("RETIREMENT");
        result.setStatus("DRAFT");

        LoginUser loginUser = new LoginUser(
                88L,
                1L,
                "dept:1",
                "admin",
                "",
                List.of("SUPER_ADMIN"),
                List.of("*:*:*"),
                List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN")));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(loginUser, null, loginUser.getAuthorities()));

        when(workflowDefinitionService.saveDraft(eq("RETIREMENT"), any(WorkflowDefinitionSaveDTO.class), eq(88L))).thenReturn(result);

        mockMvc.perform(put("/workflows/{businessType}/draft", "RETIREMENT")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(saveDTO)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(workflowDefinitionService).saveDraft(eq("RETIREMENT"), any(WorkflowDefinitionSaveDTO.class), eq(88L));
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
                .header("Authorization", "Bearer test-token")
                .contentType(MediaType.APPLICATION_JSON))
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

        WorkflowDefinitionDTO result = new WorkflowDefinitionDTO();
        result.setBusinessType("RETIREMENT");
        result.setStatus("PUBLISHED");

        when(workflowDefinitionService.updateStatus(eq("RETIREMENT"), any(WorkflowStatusUpdateDTO.class), anyLong())).thenReturn(result);

        mockMvc.perform(post("/workflows/{businessType}/status", "RETIREMENT")
                .header("Authorization", "Bearer test-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(statusDTO)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(workflowDefinitionService).updateStatus(eq("RETIREMENT"), any(WorkflowStatusUpdateDTO.class), anyLong());
    }

    private Method findMethod(String methodName) throws NoSuchMethodException {
        for (Method method : WorkflowDefinitionController.class.getDeclaredMethods()) {
            if (method.getName().equals(methodName)) {
                return method;
            }
        }
        throw new NoSuchMethodException("WorkflowDefinitionController." + methodName);
    }
}
