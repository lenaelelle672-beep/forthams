package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.common.exception.ConflictException;
import com.ams.dto.FlowDesignerOperationDTO;
import com.ams.dto.FlowDesignerValidationResultDTO;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowDesignerDraftDTO;
import com.ams.dto.WorkflowStatusUpdateDTO;
import com.ams.entity.User;
import com.ams.service.AuditService;
import com.ams.service.TenantAuthorityService;
import com.ams.service.WorkflowDefinitionService;
import com.ams.utils.AuditHelper;
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
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class WorkflowDefinitionControllerTest {

    @Mock
    private WorkflowDefinitionService workflowDefinitionService;

    @Mock
    private com.ams.service.WorkflowAssigneePreviewService workflowAssigneePreviewService;

    @Mock
    private TenantAuthorityService tenantAuthorityService;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private AuditService auditService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        AuditHelper auditHelper = new AuditHelper(jwtUtil);
        User platformAdmin = new User();
        platformAdmin.setId(42L);
        platformAdmin.setPlatformAdmin(true);
        lenient().when(tenantAuthorityService.requirePlatformAdmin()).thenReturn(platformAdmin);
        mockMvc = MockMvcBuilders.standaloneSetup(new WorkflowDefinitionController(workflowDefinitionService,
                        workflowAssigneePreviewService, tenantAuthorityService, jwtUtil, auditService, auditHelper))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void listShouldRequireFlowQueryPermission() throws Exception {
        grant("system:flow:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(workflowDefinitionService.listDefinitions()).thenReturn(List.of(definition()));

        mockMvc.perform(get("/workflows")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].businessType").value("ASSET_TRANSFER"));

        verify(workflowDefinitionService).listDefinitions();
    }

    @Test
    void saveDesignerDraftShouldRejectMissingPermissionFailClosed() throws Exception {
        grant("system:flow:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(put("/workflows/ASSET_TRANSFER/designer/draft")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"资产转移流程\",\"graph\":{\"nodes\":[],\"edges\":[]}}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(workflowDefinitionService);
    }

    @Test
    void saveDesignerDraftShouldUseJwtOperatorAndEditPermission() throws Exception {
        grant("workflow:designer:edit");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(workflowDefinitionService.saveDesignerDraft(eq("ASSET_TRANSFER"), any(), eq(42L))).thenReturn(designerDraft());

        mockMvc.perform(put("/workflows/ASSET_TRANSFER/designer/draft")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"资产转移流程\",\"expectedRevision\":2,\"graph\":{\"nodes\":[{\"id\":\"start\",\"type\":\"START\"}],\"edges\":[]}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        ArgumentCaptor<com.ams.dto.FlowDesignerDraftDTO> draftCaptor = ArgumentCaptor.forClass(com.ams.dto.FlowDesignerDraftDTO.class);
        verify(workflowDefinitionService).saveDesignerDraft(eq("ASSET_TRANSFER"), draftCaptor.capture(), eq(42L));
        assertEquals(2, draftCaptor.getValue().getExpectedRevision());
    }

    @Test
    void validateShouldRequireEditPermissionAndReturnGraphErrors() throws Exception {
        grant("workflow:designer:edit");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        FlowDesignerValidationResultDTO result = new FlowDesignerValidationResultDTO();
        result.setValid(false);
        result.setErrors(List.of("流程图不能为空"));
        when(workflowDefinitionService.validateDesignerGraph(any())).thenReturn(result);

        mockMvc.perform(post("/workflows/ASSET_TRANSFER/designer/validate")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nodes\":[],\"edges\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.valid").value(false))
                .andExpect(jsonPath("$.data.errors[0]").value("流程图不能为空"));

        verify(workflowDefinitionService).validateDesignerGraph(any());
    }

    @Test
    void publishShouldRequirePublishPermissionAndInjectAuditOperator() throws Exception {
        grant("workflow:designer:publish");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(workflowDefinitionService.publish(eq("ASSET_TRANSFER"), any())).thenReturn(definition());

        mockMvc.perform(post("/workflows/ASSET_TRANSFER/publish")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirmed\":true,\"expectedDraftRevision\":3,\"publishNote\":\"发布稳定版本\",\"impactScope\":\"后续新发起审批\",\"rollbackPlan\":\"恢复上一版本\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        ArgumentCaptor<FlowDesignerOperationDTO> captor = ArgumentCaptor.forClass(FlowDesignerOperationDTO.class);
        verify(workflowDefinitionService).publish(eq("ASSET_TRANSFER"), captor.capture());
        verify(tenantAuthorityService).requirePlatformAdmin();
        assertEquals(42L, captor.getValue().getOperatorId());
        assertEquals(true, captor.getValue().getConfirmed());
        assertEquals(3, captor.getValue().getExpectedDraftRevision());
    }

    @Test
    void staleDraftSaveShouldReturnActionableHttpConflict() throws Exception {
        grant("workflow:designer:edit");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(workflowDefinitionService.saveDraft(eq("ASSET_TRANSFER"), any(WorkflowDefinitionSaveDTO.class)))
                .thenThrow(new ConflictException("流程草稿已被其他编辑者更新，请刷新后重试"));

        mockMvc.perform(put("/workflows/ASSET_TRANSFER/draft")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"资产转移流程\",\"description\":\"说明\",\"expectedRevision\":1,\"definition\":{\"nodes\":[],\"edges\":[]}}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("刷新")));
    }

    @Test
    void concurrentPublishRetryWithConsumedRevisionShouldReturnHttpConflict() throws Exception {
        grant("workflow:designer:publish");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(workflowDefinitionService.publish(eq("ASSET_TRANSFER"), any(FlowDesignerOperationDTO.class)))
                .thenThrow(new ConflictException("流程草稿已被其他发布者消费，请重新审阅后重试"));

        mockMvc.perform(post("/workflows/ASSET_TRANSFER/publish")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirmed\":true,\"expectedDraftRevision\":3,\"publishNote\":\"重试发布\",\"impactScope\":\"后续新发起审批\",\"rollbackPlan\":\"恢复上一版本\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("重新审阅")));
    }

    @Test
    void rollbackShouldRejectUserWithoutRollbackPermission() throws Exception {
        grant("workflow:designer:publish");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(post("/workflows/ASSET_TRANSFER/versions/1/rollback")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirmed\":true,\"reason\":\"恢复稳定版本\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(workflowDefinitionService);
    }

    @Test
    void missingUserIdShouldRejectDesignerActionFailClosed() throws Exception {
        grant("workflow:designer:edit");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(null);

        mockMvc.perform(put("/workflows/ASSET_TRANSFER/designer/draft")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"资产转移流程\",\"graph\":{\"nodes\":[],\"edges\":[]}}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(workflowDefinitionService);
    }

    @Test
    void missingAuthorityShouldRejectQueryFailClosed() throws Exception {
        grant();
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(get("/workflows")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(workflowDefinitionService);
    }

    @Test
    void designerDraftReadShouldRequireEditPermission() throws Exception {
        grant("system:flow:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(get("/workflows/ASSET_TRANSFER/designer")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(workflowDefinitionService);
    }

    @Test
    void designerAssigneePreviewShouldRequireEditPermission() throws Exception {
        grant("system:flow:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(post("/workflows/ASSET_TRANSFER/assignees/preview")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"definition\":{\"nodes\":[],\"edges\":[]}}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(workflowAssigneePreviewService);
    }

    @Test
    void superAdminRoleWithoutExplicitDesignerPermissionShouldBeRejected() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(99L);

        mockMvc.perform(post("/workflows/ASSET_TRANSFER/publish")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirmed\":true,\"publishNote\":\"发布稳定版本\",\"impactScope\":\"后续新发起审批\",\"rollbackPlan\":\"恢复上一版本\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(workflowDefinitionService);
    }

    @Test
    void tenantAdminWithExplicitDesignerAuthorityCannotConfigureDesigner() throws Exception {
        grant("ROLE_TENANT_ADMIN", "workflow:designer:edit");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(tenantAuthorityService.requirePlatformAdmin())
                .thenThrow(new org.springframework.security.access.AccessDeniedException("仅显式平台管理员可以管理租户"));

        mockMvc.perform(put("/workflows/ASSET_TRANSFER/designer/draft")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"资产转移流程\",\"graph\":{\"nodes\":[],\"edges\":[]}}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verify(tenantAuthorityService).requirePlatformAdmin();
        verifyNoInteractions(workflowDefinitionService);
    }

    @Test
    void publishedWorkflowStatusMustRequirePublishPermission() throws Exception {
        grant("workflow:designer:edit");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(post("/workflows/ASSET_TRANSFER/status")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DISABLED\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(workflowDefinitionService);
    }

    @Test
    void publishedWorkflowStatusShouldUsePublishPermissionAndTenantOrPlatformAdmin() throws Exception {
        grant("workflow:designer:publish");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(workflowDefinitionService.updateStatus(eq("ASSET_TRANSFER"), any())).thenReturn(definition());

        mockMvc.perform(post("/workflows/ASSET_TRANSFER/status")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"DISABLED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        ArgumentCaptor<WorkflowStatusUpdateDTO> captor = ArgumentCaptor.forClass(WorkflowStatusUpdateDTO.class);
        verify(workflowDefinitionService).updateStatus(eq("ASSET_TRANSFER"), captor.capture());
        verify(tenantAuthorityService).requirePlatformAdmin();
        assertEquals(42L, captor.getValue().getOperatorId());
    }

    @Test
    void missingBearerTokenShouldRejectQuery() throws Exception {
        mockMvc.perform(get("/workflows"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(workflowDefinitionService);
    }

    private WorkflowDefinitionDTO definition() {
        WorkflowDefinitionDTO dto = new WorkflowDefinitionDTO();
        dto.setBusinessType("ASSET_TRANSFER");
        dto.setName("资产转移流程");
        dto.setDescription("用于资产转移审批");
        dto.setDefinition(Map.of("nodes", List.of(), "edges", List.of()));
        dto.setStatus("DRAFT");
        dto.setVersion(0);
        return dto;
    }

    private WorkflowDesignerDraftDTO designerDraft() {
        WorkflowDesignerDraftDTO dto = new WorkflowDesignerDraftDTO();
        dto.setBusinessType("ASSET_TRANSFER");
        dto.setName("资产转移流程草稿");
        dto.setDescription("仅设计器可见");
        dto.setDefinition(Map.of("nodes", List.of(), "edges", List.of()));
        dto.setStatus("DRAFT");
        dto.setVersion(0);
        return dto;
    }

    private void grant(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin",
                "n/a",
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()
        ));
    }
}
