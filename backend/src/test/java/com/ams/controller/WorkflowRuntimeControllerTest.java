package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Arrays;
import java.util.Map;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class WorkflowRuntimeControllerTest {

    @Mock
    private WorkflowDefinitionService workflowDefinitionService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new WorkflowRuntimeController(workflowDefinitionService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void startAvailabilityShouldAllowWhenPublished() throws Exception {
        grant("system:flow:query");
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
    void startAvailabilityShouldBlockWhenDraft() throws Exception {
        grant("system:flow:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(workflowDefinitionService.getDefinition("ASSET_TRANSFER")).thenReturn(definition("DRAFT", 0, 101L));

        mockMvc.perform(get("/workflow-runtime/ASSET_TRANSFER/start-availability")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.canStart").value(false))
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.blockReason").isNotEmpty());
    }

    @Test
    void startAvailabilityShouldBlockWhenDisabled() throws Exception {
        grant("system:flow:query");
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
    void startAvailabilityShouldRequireFlowQueryPermissionFailClosed() throws Exception {
        // 无权限码
        grant("some-other-permission");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(get("/workflow-runtime/ASSET_TRANSFER/start-availability")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    void startAvailabilityShouldAcceptSuperAdmin() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(workflowDefinitionService.getDefinition("ASSET_TRANSFER")).thenReturn(definition("PUBLISHED", 1, 101L));

        mockMvc.perform(get("/workflow-runtime/ASSET_TRANSFER/start-availability")
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.canStart").value(true));
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
