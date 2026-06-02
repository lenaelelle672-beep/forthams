package com.ams.controller;

import com.ams.dto.ApprovalCreateDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.service.ApprovalService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "server.servlet.context-path=/api")
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Approval Controller Tests")
class ApprovalControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ApprovalService approvalService;

    @MockBean
    private JwtUtil jwtUtil;

    @Test
    @DisplayName("Should create approval with applicant id from JWT")
    void createUsesJwtUserId() throws Exception {
        ApprovalProcess process = new ApprovalProcess();
        when(jwtUtil.getUserIdFromToken("test-token")).thenReturn(42L);
        when(approvalService.createProcess(any())).thenReturn(process);

        mockMvc.perform(post("/api/approvals")
                        .contextPath("/api")
                        .header("Authorization", "Bearer test-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Approval\",\"applicantId\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        ArgumentCaptor<ApprovalCreateDTO> captor = ArgumentCaptor.forClass(ApprovalCreateDTO.class);
        verify(approvalService).createProcess(captor.capture());
        assertThat(captor.getValue().getApplicantId()).isEqualTo(42L);
    }

    @Test
    @DisplayName("Should approve with user id from JWT")
    void approveUsesJwtUserId() throws Exception {
        ApprovalProcess process = new ApprovalProcess();
        when(jwtUtil.getUserIdFromToken("test-token")).thenReturn(42L);
        when(approvalService.approve(eq(7L), eq(42L), eq("APPROVED"), eq("ok"))).thenReturn(process);

        mockMvc.perform(post("/api/approvals/{id}/approve", 7L)
                        .contextPath("/api")
                        .header("Authorization", "Bearer test-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"result\":\"APPROVED\",\"opinion\":\"ok\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(approvalService).approve(7L, 42L, "APPROVED", "ok");
    }

    @Test
    @DisplayName("Should query pending approvals with user id from JWT")
    void pendingUsesJwtUserId() throws Exception {
        when(jwtUtil.getUserIdFromToken("test-token")).thenReturn(42L);
        when(approvalService.getMyPendingApprovals(eq(42L), any())).thenReturn(List.of());

        mockMvc.perform(get("/api/approvals/pending")
                        .contextPath("/api")
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(approvalService).getMyPendingApprovals(eq(42L), any());
    }

    @Test
    @DisplayName("Should list approvals with processType filter")
    void listWithProcessTypeFilter() throws Exception {
        when(approvalService.queryProcesses(eq(1), eq(10), eq(null), eq("WORK_ORDER"), eq(null), eq(null)))
                .thenReturn(new com.baomidou.mybatisplus.extension.plugins.pagination.Page<>());

        mockMvc.perform(get("/api/approvals/list")
                        .contextPath("/api")
                        .param("processType", "WORK_ORDER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(approvalService).queryProcesses(1, 10, null, "WORK_ORDER", null, null);
    }

    @Test
    @DisplayName("Should pass keyword to approval query service")
    void listPassesKeywordFilter() throws Exception {
        when(approvalService.queryProcesses(eq(1), eq(10), eq(null), eq(null), eq(null), eq("WO-001")))
                .thenReturn(new com.baomidou.mybatisplus.extension.plugins.pagination.Page<>());

        mockMvc.perform(get("/api/approvals/list")
                        .contextPath("/api")
                        .param("keyword", "WO-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(approvalService).queryProcesses(1, 10, null, null, null, "WO-001");
    }

    @Test
    @DisplayName("Should get approval detail by id")
    void getByIdReturnsProcessDetail() throws Exception {
        when(approvalService.getProcessById(eq(7L))).thenReturn(Map.of(
                "process", new ApprovalProcess(),
                "records", List.of(),
                "workflowRuntimePath", List.of(Map.of("stepNo", 1, "nodeId", "approval-1")),
                "workflowResultAction", "审批完成并归档"));

        mockMvc.perform(get("/api/approvals/{id}", 7L)
                        .contextPath("/api"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.workflowRuntimePath[0].nodeId").value("approval-1"))
                .andExpect(jsonPath("$.data.workflowResultAction").value("审批完成并归档"));

        verify(approvalService).getProcessById(7L);
    }

    @Test
    @DisplayName("Should get pending count")
    void pendingCountReturnsCount() throws Exception {
        when(approvalService.getPendingCount()).thenReturn(5L);

        mockMvc.perform(get("/api/approvals/pending/count")
                        .contextPath("/api"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").value(5));

        verify(approvalService).getPendingCount();
    }

    @Test
    @DisplayName("Should cancel approval with user id from JWT")
    void cancelUsesJwtUserId() throws Exception {
        ApprovalProcess process = new ApprovalProcess();
        when(jwtUtil.getUserIdFromToken("test-token")).thenReturn(42L);
        when(approvalService.cancelProcess(eq(7L), eq(42L))).thenReturn(process);

        mockMvc.perform(post("/api/approvals/{id}/cancel", 7L)
                        .contextPath("/api")
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(approvalService).cancelProcess(7L, 42L);
    }
}
