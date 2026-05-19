package com.ams.controller;

import com.ams.entity.ApprovalProcess;
import com.ams.service.ApprovalService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "server.servlet.context-path=/api")
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Notification controller tests")
class NotificationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ApprovalService approvalService;

    @MockBean
    private JwtUtil jwtUtil;

    @Test
    @DisplayName("Should expose pending notification list derived from approvals")
    void pendingReturnsApprovalNotifications() throws Exception {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(7L);
        process.setProcessNo("APR-001");
        process.setProcessType("WORK_ORDER");
        process.setApplyTime(LocalDateTime.of(2026, 5, 19, 8, 0));

        when(jwtUtil.getUserIdFromToken("test-token")).thenReturn(42L);
        when(approvalService.getMyPendingApprovals(eq(42L))).thenReturn(List.of(process));

        mockMvc.perform(get("/api/notifications/pending")
                        .contextPath("/api")
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.unread_count").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(7))
                .andExpect(jsonPath("$.data.items[0].type").value("work_order"))
                .andExpect(jsonPath("$.data.items[0].title").value("APR-001"));

        verify(approvalService).getMyPendingApprovals(42L);
    }

    @Test
    @DisplayName("Should expose pending notification count")
    void pendingCountReturnsUserScopedCount() throws Exception {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(8L);

        when(jwtUtil.getUserIdFromToken("test-token")).thenReturn(42L);
        when(approvalService.getMyPendingApprovals(eq(42L))).thenReturn(List.of(process));

        mockMvc.perform(get("/api/notifications/pending/count")
                        .contextPath("/api")
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").value(1));

        verify(approvalService).getMyPendingApprovals(42L);
    }
}
