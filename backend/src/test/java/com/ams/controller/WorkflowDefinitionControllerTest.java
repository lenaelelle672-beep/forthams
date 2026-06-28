package com.ams.controller;

import com.ams.annotation.OperBusinessType;
import com.ams.annotation.OperLog;
import com.ams.dto.WorkflowAssigneePreviewResponse;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowDefinitionVersionDTO;
import com.ams.dto.WorkflowRuntimeAssigneePreviewRequest;
import com.ams.dto.WorkflowStartAvailabilityDTO;
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
        Map<String, String> expected = Map.ofEntries(
                Map.entry("list", "@ss.hasPermi('workflow:definition:query')"),
                Map.entry("get", "@ss.hasPermi('workflow:definition:query')"),
                Map.entry("listVersions", "@ss.hasPermi('workflow:definition:query')"),
                Map.entry("getVersion", "@ss.hasPermi('workflow:definition:query')"),
                Map.entry("previewAssignees", "@ss.hasPermi('workflow:definition:query')"),
                Map.entry("saveDraft", "@ss.hasPermi('workflow:definition:edit')"),
                Map.entry("publish", "@ss.hasPermi('workflow:definition:edit')"),
                Map.entry("rollbackToVersion", "@ss.hasPermi('workflow:definition:edit')"),
                Map.entry("updateStatus", "@ss.hasPermi('workflow:definition:edit')"),
                Map.entry("createCustomDefinition", "@ss.hasPermi('workflow:definition:edit')"),
                Map.entry("deleteDefinition", "@ss.hasPermi('workflow:definition:edit')"));

        for (Map.Entry<String, String> entry : expected.entrySet()) {
            Method method = findMethod(entry.getKey());
            PreAuthorize preAuthorize = method.getAnnotation(PreAuthorize.class);
            assertNotNull(preAuthorize, entry.getKey() + " should declare @PreAuthorize");
            assertEquals(entry.getValue(), preAuthorize.value());
        }
    }

    @Test
    @DisplayName("Should protect workflow runtime start availability with approval create permission")
    void shouldProtectWorkflowRuntimeStartAvailabilityWithApprovalCreatePermission() throws Exception {
        Method method = WorkflowRuntimeController.class.getDeclaredMethod("startAvailability", String.class);
        PreAuthorize preAuthorize = method.getAnnotation(PreAuthorize.class);
        OperLog operLog = method.getAnnotation(OperLog.class);

        assertNotNull(preAuthorize);
        assertEquals("@ss.hasPermi('approval:process:create')", preAuthorize.value());
        assertNotNull(operLog);
        assertEquals("审批发起可用性检查", operLog.title());
        assertEquals(OperBusinessType.OTHER, operLog.businessType());
        assertEquals(false, operLog.saveRequestData());
    }

    @Test
    @DisplayName("Should protect workflow runtime assignee preview with approval create permission")
    void shouldProtectWorkflowRuntimeAssigneePreviewWithApprovalCreatePermission() throws Exception {
        Method method = WorkflowRuntimeController.class.getDeclaredMethod(
                "previewAssignees", String.class, WorkflowRuntimeAssigneePreviewRequest.class);
        PreAuthorize preAuthorize = method.getAnnotation(PreAuthorize.class);

        assertNotNull(preAuthorize);
        assertEquals("@ss.hasPermi('approval:process:create')", preAuthorize.value());
    }

    @Test
    @DisplayName("Should audit runtime assignee preview without saving request data")
    void shouldAuditRuntimeAssigneePreviewWithoutSavingRequestData() throws Exception {
        Method method = WorkflowRuntimeController.class.getDeclaredMethod(
                "previewAssignees", String.class, WorkflowRuntimeAssigneePreviewRequest.class);
        OperLog operLog = method.getAnnotation(OperLog.class);

        assertNotNull(operLog);
        assertEquals("处理人预览", operLog.title());
        assertEquals(OperBusinessType.OTHER, operLog.businessType());
        assertEquals(false, operLog.saveRequestData());
    }

    @Test
    @DisplayName("Should annotate workflow mutations with operation logs")
    void shouldAnnotateMutationsWithOperLog() throws Exception {
        Map<String, String> expectedTitles = Map.of(
                "previewAssignees", "处理人预览",
                "saveDraft", "流程草稿保存",
                "publish", "流程发布",
                "rollbackToVersion", "流程回滚",
                "updateStatus", "流程状态更新",
                "deleteDefinition", "流程定义删除");
        Map<String, OperBusinessType> expectedTypes = Map.of(
                "previewAssignees", OperBusinessType.OTHER,
                "saveDraft", OperBusinessType.UPDATE,
                "publish", OperBusinessType.UPDATE,
                "rollbackToVersion", OperBusinessType.UPDATE,
                "updateStatus", OperBusinessType.UPDATE,
                "deleteDefinition", OperBusinessType.DELETE);

        for (Map.Entry<String, String> entry : expectedTitles.entrySet()) {
            Method method = findMethod(entry.getKey());
            OperLog operLog = method.getAnnotation(OperLog.class);
            assertNotNull(operLog, entry.getKey() + " should declare @OperLog");
            assertEquals(entry.getValue(), operLog.title());
            assertEquals(expectedTypes.get(entry.getKey()), operLog.businessType());
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
    @DisplayName("Should preview workflow assignees through readonly endpoint")
    void testPreviewAssignees() throws Exception {
        WorkflowAssigneePreviewResponse result = new WorkflowAssigneePreviewResponse();
        result.setBusinessType("RETIREMENT");
        result.setCalculable(false);
        result.setReason("条件字段缺失，无法可靠计算处理人");
        result.setMissingFields(List.of("amount"));

        when(workflowDefinitionService.previewAssignees(eq("RETIREMENT"), any())).thenReturn(result);

        mockMvc.perform(post("/workflows/{businessType}/assignees/preview", "RETIREMENT")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "definition", Map.of("nodes", List.of(), "edges", List.of()),
                        "businessData", Map.of()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.calculable").value(false))
            .andExpect(jsonPath("$.data.missingFields[0]").value("amount"));

        verify(workflowDefinitionService).previewAssignees(eq("RETIREMENT"), any());
    }

    @Test
    @DisplayName("Should list immutable workflow version history without definition payload")
    void testListVersions() throws Exception {
        WorkflowDefinitionVersionDTO version = new WorkflowDefinitionVersionDTO();
        version.setBusinessType("ASSET_TRANSFER");
        version.setVersion(3);
        version.setActionType("PUBLISH");
        version.setStatus("PUBLISHED");
        version.setName("资产转移流程");

        when(workflowDefinitionService.listVersionHistory("ASSET_TRANSFER")).thenReturn(List.of(version));

        mockMvc.perform(get("/workflows/{businessType}/versions", "ASSET_TRANSFER")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data[0].businessType").value("ASSET_TRANSFER"))
            .andExpect(jsonPath("$.data[0].version").value(3))
            .andExpect(jsonPath("$.data[0].definition").doesNotExist());

        verify(workflowDefinitionService).listVersionHistory("ASSET_TRANSFER");
    }

    @Test
    @DisplayName("Should return workflow version detail with definition payload")
    void testGetVersion() throws Exception {
        WorkflowDefinitionVersionDTO version = new WorkflowDefinitionVersionDTO();
        version.setBusinessType("ASSET_TRANSFER");
        version.setVersion(2);
        version.setActionType("ROLLBACK");
        version.setStatus("PUBLISHED");
        version.setName("资产转移流程");
        version.setDefinition(Map.of("nodes", List.of()));

        when(workflowDefinitionService.getVersion("ASSET_TRANSFER", 2)).thenReturn(version);

        mockMvc.perform(get("/workflows/{businessType}/versions/{version}", "ASSET_TRANSFER", 2)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.version").value(2))
            .andExpect(jsonPath("$.data.definition.nodes").isArray());

        verify(workflowDefinitionService).getVersion("ASSET_TRANSFER", 2);
    }

    @Test
    @DisplayName("Should return applicant-facing workflow start availability")
    void testStartAvailability() throws Exception {
        WorkflowStartAvailabilityDTO result = new WorkflowStartAvailabilityDTO(
                "ASSET_TRANSFER", true, "PUBLISHED", 3, 7L,
                "/disposals/transfer/new", "");

        when(workflowDefinitionService.getStartAvailability("ASSET_TRANSFER")).thenReturn(result);

        mockMvc.perform(get("/workflow-runtime/{businessType}/start-availability", "ASSET_TRANSFER")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.canStart").value(true))
            .andExpect(jsonPath("$.data.version").value(3))
            .andExpect(jsonPath("$.data.definitionId").value(7))
            .andExpect(jsonPath("$.data.entryUrl").value("/disposals/transfer/new"));

        verify(workflowDefinitionService).getStartAvailability("ASSET_TRANSFER");
    }

    @Test
    @DisplayName("Should preview applicant-facing runtime assignees without definition payload")
    void testRuntimeAssigneePreview() throws Exception {
        WorkflowAssigneePreviewResponse result = new WorkflowAssigneePreviewResponse();
        result.setBusinessType("ASSET_TRANSFER");
        result.setCalculable(true);
        WorkflowAssigneePreviewResponse.NodeAssigneePreview node = new WorkflowAssigneePreviewResponse.NodeAssigneePreview();
        node.setStepNo(1);
        node.setNodeId("approval-1");
        node.setLabel("部门审批");
        node.setResolved(true);
        node.setAssigneeCount(1);
        node.setAssignees(List.of());
        result.setNodes(List.of(node));

        when(workflowDefinitionService.previewPublishedAssignees(eq("ASSET_TRANSFER"), any())).thenReturn(result);

        mockMvc.perform(post("/workflow-runtime/{businessType}/assignees/preview", "ASSET_TRANSFER")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "businessData", Map.of("toDept", "2", "targetDeptId", "2")))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.calculable").value(true))
            .andExpect(jsonPath("$.data.nodes[0].assigneeCount").value(1))
            .andExpect(jsonPath("$.data.nodes[0].assignees").isEmpty())
            .andExpect(jsonPath("$.data.nodes[0].assignees[0].userId").doesNotExist());

        verify(workflowDefinitionService).previewPublishedAssignees(eq("ASSET_TRANSFER"), any());
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

        when(workflowDefinitionService.publish(eq("RETIREMENT"), isNull(), any())).thenReturn(result);

        mockMvc.perform(post("/workflows/{businessType}/publish", "RETIREMENT")
                .header("Authorization", "Bearer test-token")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(workflowDefinitionService).publish(eq("RETIREMENT"), isNull(), any());
    }

    @Test
    @WithMockUser(roles = "SUPER_ADMIN")
    @DisplayName("Should rollback workflow to a historical published version")
    void testRollbackToVersion() throws Exception {
        WorkflowDefinitionDTO result = new WorkflowDefinitionDTO();
        result.setBusinessType("ASSET_TRANSFER");
        result.setStatus("PUBLISHED");
        result.setVersion(4);

        when(workflowDefinitionService.rollbackToVersion(eq("ASSET_TRANSFER"), eq(1), any(), anyLong())).thenReturn(result);

        mockMvc.perform(post("/workflows/{businessType}/versions/{version}/rollback", "ASSET_TRANSFER", 1)
                .header("Authorization", "Bearer test-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("reason", "恢复稳定版本"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.status").value("PUBLISHED"))
            .andExpect(jsonPath("$.data.version").value(4));

        verify(workflowDefinitionService).rollbackToVersion(eq("ASSET_TRANSFER"), eq(1), any(), anyLong());
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
