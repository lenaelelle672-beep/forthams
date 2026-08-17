package com.ams.controller;

import com.ams.dto.ApprovalCreateDTO;
import com.ams.dto.ApprovalRecoveryDTO;
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
import org.springframework.security.test.context.support.WithMockUser;

import java.util.List;

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
@WithMockUser(authorities = {"approval:query", "approval:create", "approval:approve"})
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
                        .content("{\"processType\":\"WORK_ORDER\",\"title\":\"Approval\",\"businessId\":7,\"applicantId\":1}"))
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
        when(approvalService.getMyPendingApprovals(eq(42L))).thenReturn(List.of());

        mockMvc.perform(get("/api/approvals/pending")
                        .contextPath("/api")
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(approvalService).getMyPendingApprovals(42L);
    }

    @Test
    @DisplayName("Should return recovery guidance for an audited cancelled approval")
    void recoveryReturnsServiceGuidance() throws Exception {
        ApprovalRecoveryDTO recovery = new ApprovalRecoveryDTO();
        recovery.setProcessId(7L);
        recovery.setResubmissionAction("RESUBMIT_EXISTING");
        when(approvalService.getRecoveryGuidance(7L)).thenReturn(recovery);

        mockMvc.perform(get("/api/approvals/{id}/recovery", 7L)
                        .contextPath("/api"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.processId").value(7))
                .andExpect(jsonPath("$.data.resubmissionAction").value("RESUBMIT_EXISTING"));

        verify(approvalService).getRecoveryGuidance(7L);
    }
}
