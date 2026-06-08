package com.ams.controller;

import com.ams.entity.NotificationPreference;
import com.ams.entity.User;
import com.ams.mapper.UserMapper;
import com.ams.service.NotificationPreferenceService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "server.servlet.context-path=/api")
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("通知偏好控制器测试")
class NotificationPreferenceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private NotificationPreferenceService notificationPreferenceService;

    @MockBean
    private UserMapper userMapper;

    @BeforeEach
    void setUpSecurityContext() {
        User user = new User();
        user.setId(42L);
        user.setUsername("testuser");
        user.setStatus(1);
        when(userMapper.selectOne(any())).thenReturn(user);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("testuser", null, List.of()));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("个人偏好列表使用当前用户 ID")
    void listUsesCurrentUserId() throws Exception {
        mockMvc.perform(get("/api/notification-preferences").contextPath("/api"))
                .andExpect(status().isOk());

        verify(notificationPreferenceService).getByUserId(42L);
    }

    @Test
    @DisplayName("按分类查询使用当前用户 ID")
    void categoryUsesCurrentUserId() throws Exception {
        mockMvc.perform(get("/api/notification-preferences/retirement").contextPath("/api"))
                .andExpect(status().isOk());

        verify(notificationPreferenceService).getByUserAndCategory(42L, "retirement");
    }

    @Test
    @DisplayName("批量保存使用当前用户 ID 而不是 0L")
    void batchSaveUsesCurrentUserId() throws Exception {
        mockMvc.perform(put("/api/notification-preferences/batch")
                        .contextPath("/api")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[{\"category\":\"retirement\",\"inApp\":1,\"email\":0}]"))
                .andExpect(status().isOk());

        verify(notificationPreferenceService).batchSave(eq(42L), any());
    }

    @Test
    @DisplayName("用户不存在时拒绝个人偏好访问")
    void missingUserIsRejected() throws Exception {
        when(userMapper.selectOne(any())).thenReturn(null);

        mockMvc.perform(get("/api/notification-preferences").contextPath("/api"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(notificationPreferenceService);
    }
}
