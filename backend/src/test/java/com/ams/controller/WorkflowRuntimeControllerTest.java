package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.WorkflowAssigneePreviewDTO;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowStartAvailabilityDTO;
import com.ams.service.WorkflowDefinitionService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Arrays;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class WorkflowRuntimeControllerTest {

    @Mock
    private WorkflowDefinitionService workflowDefinitionService;

    @Mock
    private com.ams.service.WorkflowAssigneePreviewService workflowAssigneePreviewService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new WorkflowRuntimeController(workflowDefinitionService, workflowAssigneePreviewService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void startAvailabilityShouldAllowWhenPublished() throws Exception {
        grant("disposal:create");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(workflowDefinitionService.getDefinition("ASSET_TRANSFER")).thenReturn(definition("PUBLISHED", 3, 101L));

        mockMvc.perform(get("/workflow-runtime/ASSET_TRANSFER/start-availability")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.businessType").value("ASSET_TRANSFER"))
                .andExpect(jsonPath("$.data.canStart").value(true))
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.data.version").value(3))
                .andExpect(jsonPath("$.data.entryUrl").isNotEmpty())
                .andExpect(jsonPath("$.data.blockReason").value(""));
    }

    @Test
    void startAvailabilityShouldNotExposeDraftAvailability() throws Exception {
        grant("disposal:create");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(workflowDefinitionService.getDefinition("ASSET_TRANSFER")).thenReturn(definition("DRAFT", 0, 101L));

        mockMvc.perform(get("/workflow-runtime/ASSET_TRANSFER/start-availability")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.canStart").value(false))
                .andExpect(jsonPath("$.data.status").value("UNCONFIGURED"))
                .andExpect(jsonPath("$.data.version").value(0))
                .andExpect(jsonPath("$.data.blockReason").value("该业务类型尚未发布可用流程"));
    }

    @Test
    void startAvailabilityShouldBlockWhenDisabled() throws Exception {
        grant("disposal:create");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(workflowDefinitionService.getDefinition("ASSET_TRANSFER")).thenReturn(definition("DISABLED", 2, 101L));

        mockMvc.perform(get("/workflow-runtime/ASSET_TRANSFER/start-availability")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.canStart").value(false))
                .andExpect(jsonPath("$.data.status").value("DISABLED"))
                .andExpect(jsonPath("$.data.blockReason").value("流程定义已停用，请联系管理员启用"));
    }

    @Test
    void startAvailabilityShouldRequireMappedBusinessPermissionFailClosed() throws Exception {
        // 无权限码
        grant("some-other-permission");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(get("/workflow-runtime/ASSET_TRANSFER/start-availability")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    void startAvailabilityShouldRejectDesignerPermissionWithoutMappedBusinessPermission() throws Exception {
        grant("system:flow:query", "workflow:designer:publish");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(get("/workflow-runtime/ASSET_TRANSFER/start-availability")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(workflowDefinitionService);
    }

    @Test
    void startAvailabilityShouldRejectSuperAdminWithoutMappedBusinessPermission() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(get("/workflow-runtime/ASSET_TRANSFER/start-availability")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(workflowDefinitionService);
    }

    @Test
    void startAvailabilityShouldAllowEveryWhitelistedBusinessAction() throws Exception {
        Map<String, String> permissions = Map.of(
                "ASSET_TRANSFER", "disposal:create",
                "ASSET_CLEARANCE", "disposal:create",
                "ASSET_SCRAP", "disposal:create",
                "ASSET_COMPENSATION", "compensation:create",
                "RETIREMENT", "retirement:create",
                "WORK_ORDER", "workorder:submit"
        );
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        for (Map.Entry<String, String> entry : permissions.entrySet()) {
            grant(entry.getValue());
            when(workflowDefinitionService.getDefinition(entry.getKey())).thenReturn(definition("PUBLISHED", 3, 101L));

            mockMvc.perform(get("/workflow-runtime/{businessType}/start-availability", entry.getKey())
                            .header("Authorization", "Bearer token"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.businessType").value(entry.getKey()))
                    .andExpect(jsonPath("$.data.canStart").value(true));
        }
    }

    @Test
    void startAvailabilityShouldRejectUnknownBusinessTypeFailClosed() throws Exception {
        grant("disposal:create");

        mockMvc.perform(get("/workflow-runtime/UNKNOWN/start-availability")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(workflowDefinitionService, workflowAssigneePreviewService);
    }

    @Test
    void runtimePreviewMustDiscardClientSuppliedDefinition() throws Exception {
        grant("disposal:create");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        WorkflowDefinitionDTO published = definition("PUBLISHED", 3, 101L);
        published.setDefinition(Map.of("name", "published-v3", "nodes", java.util.List.of(), "edges", java.util.List.of()));
        when(workflowDefinitionService.getDefinition("ASSET_TRANSFER")).thenReturn(published);
        WorkflowAssigneePreviewDTO.Response response = new WorkflowAssigneePreviewDTO.Response();
        response.setBusinessType("ASSET_TRANSFER");
        response.setCalculable(false);
        when(workflowAssigneePreviewService.previewPublished(eq("ASSET_TRANSFER"), any(), any())).thenReturn(response);

        mockMvc.perform(post("/workflow-runtime/ASSET_TRANSFER/assignees/preview")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"definition\":{\"name\":\"attacker\"},\"businessData\":{\"assetId\":1}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(workflowAssigneePreviewService).previewPublished(
                eq("ASSET_TRANSFER"),
                eq(Map.of("name", "published-v3", "nodes", java.util.List.of(), "edges", java.util.List.of())),
                eq(Map.of("assetId", 1)));
    }

    @Test
    void runtimePreviewMustNotExposeUnpublishedDefinition() throws Exception {
        grant("disposal:create");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        WorkflowDefinitionDTO draft = definition("DRAFT", 1, 101L);
        draft.setDefinition(Map.of("name", "designer-only-draft", "nodes", java.util.List.of(), "edges", java.util.List.of()));
        when(workflowDefinitionService.getDefinition("ASSET_TRANSFER")).thenReturn(draft);

        mockMvc.perform(post("/workflow-runtime/ASSET_TRANSFER/assignees/preview")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"definition\":{\"name\":\"attacker\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.calculable").value(false))
                .andExpect(jsonPath("$.data.reason").value("该业务类型尚未发布可用流程"));

        verifyNoInteractions(workflowAssigneePreviewService);
    }

    private WorkflowDefinitionDTO definition(String status, int version, Long id) {
        WorkflowDefinitionDTO dto = new WorkflowDefinitionDTO();
        dto.setId(id);
        dto.setBusinessType("ASSET_TRANSFER");
        dto.setName("资产转移流程");
        dto.setDefinition(Map.of("nodes", java.util.List.of(), "edges", java.util.List.of()));
        dto.setStatus(status);
        dto.setVersion(version);
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
