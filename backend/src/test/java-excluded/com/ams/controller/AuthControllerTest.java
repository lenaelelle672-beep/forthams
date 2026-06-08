package com.ams.controller;

import com.ams.dto.AuthResponse;
import com.ams.common.exception.ConflictException;
import com.ams.dto.LoginRequest;
import com.ams.dto.RegisterRequest;
import com.ams.service.AuthService;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "server.servlet.context-path=/api")
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Auth Controller Tests")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    @Test
    @DisplayName("Should login and return token")
    void loginReturnsToken() throws Exception {
        AuthResponse mockResponse = new AuthResponse(
                "test-token", 1L, "admin", "管理员",
                List.of("SUPER_ADMIN"), List.of("system:user:query"));
        when(authService.login(any(LoginRequest.class))).thenReturn(mockResponse);

        mockMvc.perform(post("/api/auth/login")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.token").value("test-token"))
            .andExpect(jsonPath("$.data.userId").value(1))
            .andExpect(jsonPath("$.data.roles[0]").value("SUPER_ADMIN"))
            .andExpect(jsonPath("$.data.permissions[0]").value("system:user:query"));

        ArgumentCaptor<LoginRequest> captor = ArgumentCaptor.forClass(LoginRequest.class);
        verify(authService).login(captor.capture());
        assertThat(captor.getValue().getUsername()).isEqualTo("admin");
    }

    @Test
    @DisplayName("Should register and return token")
    void registerReturnsToken() throws Exception {
        AuthResponse mockResponse = new AuthResponse(
                "reg-token", 2L, "newuser", "新用户",
                List.of("USER"), List.of("dashboard:view"));
        when(authService.register(any(RegisterRequest.class))).thenReturn(mockResponse);

        mockMvc.perform(post("/api/auth/register")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"newuser\",\"password\":\"pass123\",\"realName\":\"新用户\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.token").value("reg-token"))
            .andExpect(jsonPath("$.data.userId").value(2));

        verify(authService).register(any(RegisterRequest.class));
    }

    @Test
    @DisplayName("Should return 409 when registering duplicate username")
    void registerDuplicateUsernameReturnsConflict() throws Exception {
        when(authService.register(any(RegisterRequest.class)))
                .thenThrow(new ConflictException("用户名已存在"));

        mockMvc.perform(post("/api/auth/register")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"newuser\",\"password\":\"pass123\",\"realName\":\"新用户\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value(409))
            .andExpect(jsonPath("$.message").value("用户名已存在"));

        verify(authService).register(any(RegisterRequest.class));
    }

    @Test
    @DisplayName("Should logout successfully")
    void logoutReturnsSuccess() throws Exception {
        when(authService.logout()).thenReturn(true);

        mockMvc.perform(post("/api/auth/logout")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data").value("登出成功"));

        verify(authService).logout();
    }
    @Test
    @DisplayName("Should reject reset password without old password")
    void resetPasswordWithoutOldPasswordIsRejected() throws Exception {
        mockMvc.perform(post("/api/auth/reset-password")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"admin\",\"newPassword\":\"newPass123\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Should accept reset password request with old password")
    void resetPasswordWithOldPasswordCallsService() throws Exception {
        mockMvc.perform(post("/api/auth/reset-password")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"admin\",\"oldPassword\":\"oldPass123\",\"newPassword\":\"newPass123\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(authService).resetPassword(any());
    }

}
