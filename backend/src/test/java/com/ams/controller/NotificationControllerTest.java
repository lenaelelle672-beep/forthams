package com.ams.controller;

import com.ams.entity.ApprovalProcess;
import com.ams.entity.NotificationRecord;
import com.ams.entity.User;
import com.ams.mapper.UserMapper;
import com.ams.service.ApprovalService;
import com.ams.service.NotificationService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
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
    private NotificationService notificationService;

    @MockBean
    private ApprovalService approvalService;

    @MockBean
    private UserMapper userMapper;

    @BeforeEach
    void setUpSecurityContext() {
        User mockUser = new User();
        mockUser.setId(42L);
        mockUser.setUsername("testuser");
        mockUser.setStatus(1);
        when(userMapper.selectOne(any())).thenReturn(mockUser);

        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken("testuser", null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Should expose pending notification list derived from approvals")
    void pendingReturnsApprovalNotifications() throws Exception {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(7L);
        process.setProcessNo("APR-001");
        process.setProcessType("WORK_ORDER");
        process.setApplyTime(LocalDateTime.of(2026, 5, 19, 8, 0));

        when(approvalService.getMyPendingApprovals(eq(42L))).thenReturn(List.of(process));

        mockMvc.perform(get("/api/notifications/pending")
                        .contextPath("/api"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.unread_count").value(1))
                .andExpect(jsonPath("$.data.items[0].id").value(7))
                .andExpect(jsonPath("$.data.items[0].type").value("work_order"))
                .andExpect(jsonPath("$.data.items[0].title").value("APR-001"));

        verify(approvalService).getMyPendingApprovals(42L);
    }

    @Test
    @DisplayName("Should expose pending notification count via unread count")
    void pendingCountReturnsUserScopedCount() throws Exception {
        when(notificationService.getUnreadCount(42L)).thenReturn(5L);

        mockMvc.perform(get("/api/notifications/pending/count")
                        .contextPath("/api"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").value(5));

        verify(notificationService).getUnreadCount(42L);
    }

    @Test
    @DisplayName("Should return unread count via new endpoint")
    void unreadCountReturnsCountFromService() throws Exception {
        when(notificationService.getUnreadCount(42L)).thenReturn(3L);

        mockMvc.perform(get("/api/notifications/unread-count")
                        .contextPath("/api"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").value(3));
    }

    @Test
    @DisplayName("Should return paginated notification list from service")
    void listReturnsPaginatedNotifications() throws Exception {
        NotificationRecord record = new NotificationRecord();
        record.setId(1L);
        record.setTitle("测试通知");
        record.setType("system_alert");
        record.setCategory("SYSTEM");
        record.setContent("通知内容");
        record.setIsRead(0);
        record.setCreatedAt(LocalDateTime.of(2026, 5, 22, 10, 0));

        Page<NotificationRecord> page = new Page<>(1, 10);
        page.setRecords(List.of(record));
        page.setTotal(1);

        when(notificationService.getPage(eq(42L), eq(1), eq(10), any(), any())).thenReturn(page);

        mockMvc.perform(get("/api/notifications")
                        .contextPath("/api")
                        .param("page", "1")
                        .param("pageSize", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.records[0].id").value(1))
                .andExpect(jsonPath("$.data.records[0].title").value("测试通知"))
                .andExpect(jsonPath("$.data.records[0].isRead").value(false));
    }

    @Test
    @DisplayName("Should mark notification as read via service")
    void markAsReadCallsService() throws Exception {
        mockMvc.perform(put("/api/notifications/100/read")
                        .contextPath("/api"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(notificationService).markAsRead(100L, 42L);
    }

    @Test
    @DisplayName("Should mark all notifications as read via service")
    void markAllAsReadCallsService() throws Exception {
        mockMvc.perform(put("/api/notifications/read-all")
                        .contextPath("/api"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(notificationService).markAllAsRead(42L);
    }

    @Test
    @DisplayName("Should delete notification via service")
    void deleteCallsService() throws Exception {
        mockMvc.perform(delete("/api/notifications/200")
                        .contextPath("/api"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(notificationService).delete(200L, 42L);
    }
}
