package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.common.exception.BusinessException;
import com.ams.dto.AuthResponse;
import com.ams.dto.LoginRequest;
import com.ams.dto.RegisterRequest;
import com.ams.service.AuthService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * AuthController 单元测试。
 *
 * 验证控制器仅做委托：将请求转发给 AuthService，并将结果封装为 Result。
 * 服务层逻辑由 AuthService 自身的测试覆盖，这里全部 Mock 掉。
 *
 * 注：任务清单提到的 "getCurrentUser returns user info" 在当前 AuthController
 * 中并不存在（该控制器仅暴露 login/register/logout/test 四个端点）。
 * 为对齐任务意图——验证"认证后获取当前用户信息"的端点——这里覆盖最贴近的
 * GET /auth/test，它代表认证通过后控制器可返回的简单信息端点。
 */
@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Mock
    private AuthService authService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(authService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void loginShouldReturnTokenWhenServiceAuthenticatesSuccessfully() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setUsername("alice");
        request.setPassword("secret123");

        AuthResponse authResponse = new AuthResponse("jwt.token.value", 7L, "alice", "爱丽丝");
        when(authService.login(any(LoginRequest.class))).thenReturn(authResponse);

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(OBJECT_MAPPER.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("登录成功"))
                .andExpect(jsonPath("$.data.token").value("jwt.token.value"))
                .andExpect(jsonPath("$.data.userId").value(7))
                .andExpect(jsonPath("$.data.username").value("alice"))
                .andExpect(jsonPath("$.data.realName").value("爱丽丝"));

        verify(authService).login(any(LoginRequest.class));
    }

    @Test
    void loginShouldReturnBadRequestWhenCredentialsAreInvalid() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setUsername("alice");
        request.setPassword("wrong-password");

        // AuthService 通过 Spring Security 抛出 BadCredentials，控制器层
        // 这里用 BusinessException 模拟"凭证无效"的业务侧表现，验证异常被
        // GlobalExceptionHandler 转为 400 + envelope code。
        when(authService.login(any(LoginRequest.class)))
                .thenThrow(new BusinessException("用户名或密码错误"));

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(OBJECT_MAPPER.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("用户名或密码错误"));

        verify(authService).login(any(LoginRequest.class));
    }

    @Test
    void registerShouldCreateUserAndReturnToken() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("bob");
        request.setPassword("password123");
        request.setRealName("鲍勃");
        request.setEmail("bob@example.com");
        request.setPhone("13800000000");
        request.setDeptId(10L);

        AuthResponse authResponse = new AuthResponse("jwt.token.bob", 11L, "bob", "鲍勃");
        when(authService.register(any(RegisterRequest.class))).thenReturn(authResponse);

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(OBJECT_MAPPER.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("注册成功"))
                .andExpect(jsonPath("$.data.token").value("jwt.token.bob"))
                .andExpect(jsonPath("$.data.userId").value(11))
                .andExpect(jsonPath("$.data.username").value("bob"))
                .andExpect(jsonPath("$.data.realName").value("鲍勃"));

        verify(authService).register(any(RegisterRequest.class));
    }

    @Test
    void registerShouldRejectDuplicateUsername() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("alice");
        request.setPassword("password123");
        request.setRealName("爱丽丝");
        request.setDeptId(10L);

        when(authService.register(any(RegisterRequest.class)))
                .thenThrow(new BusinessException("用户名已存在"));

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(OBJECT_MAPPER.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("用户名已存在"));

        verify(authService).register(any(RegisterRequest.class));
    }

    @Test
    void logoutShouldDelegateToServiceAndReturnSuccess() throws Exception {
        when(authService.logout()).thenReturn(true);

        // Result.success("登出成功") 解析为 success(T data)，字符串作为 data 返回，
        // message 维持默认 "操作成功"。这里同时验证控制器委托给了 AuthService。
        mockMvc.perform(post("/auth/logout"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("操作成功"))
                .andExpect(jsonPath("$.data").value("登出成功"));

        verify(authService).logout();
    }

    @Test
    void testEndpointShouldReturnSuccessWithoutCallingAuthService() throws Exception {
        mockMvc.perform(get("/auth/test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("操作成功"))
                .andExpect(jsonPath("$.data").value("认证测试成功"));
    }

    @Test
    void loginShouldRejectBlankUsernameDueToValidation() throws Exception {
        // @Valid 在控制器层拦截，不会触达 AuthService。
        String payload = "{\"username\":\"\",\"password\":\"secret123\"}";

        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));

        verify(authService, org.mockito.Mockito.never()).login(any(LoginRequest.class));
    }
}
