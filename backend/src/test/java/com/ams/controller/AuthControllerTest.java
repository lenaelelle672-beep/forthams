package com.ams.controller;

import com.ams.dto.AuthResponse;
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
        AuthResponse mockResponse = new AuthResponse("test-token", 1L, "admin", "管理员", null);
        when(authService.login(any(LoginRequest.class))).thenReturn(mockResponse);

        mockMvc.perform(post("/api/auth/login")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.token").value("test-token"))
            .andExpect(jsonPath("$.data.userId").value(1));

        ArgumentCaptor<LoginRequest> captor = ArgumentCaptor.forClass(LoginRequest.class);
        verify(authService).login(captor.capture());
        assertThat(captor.getValue().getUsername()).isEqualTo("admin");
    }

    @Test
    @DisplayName("Should register and return token")
    void registerReturnsToken() throws Exception {
        AuthResponse mockResponse = new AuthResponse("reg-token", 2L, "newuser", "新用户", null);
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
}
