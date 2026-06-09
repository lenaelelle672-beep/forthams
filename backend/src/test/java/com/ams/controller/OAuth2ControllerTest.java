package com.ams.controller;

import com.ams.entity.OAuthConfig;
import com.ams.entity.User;
import com.ams.mapper.UserMapper;
import com.ams.service.OAuthConfigService;
import com.ams.utils.JwtUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("OAuth2 Controller Tests")
class OAuth2ControllerTest {

    @Mock
    private OAuthConfigService oauthConfigService;
    @Mock
    private UserMapper userMapper;
    @Mock
    private JwtUtil jwtUtil;
    @Mock
    private RestTemplate restTemplate;

    @Test
    @DisplayName("OAuth config management endpoints require seeded system config permissions")
    void configManagementEndpointsRequireSystemConfigPermissions() throws Exception {
        Map<String, String> expected = Map.of(
                "listConfig", "@ss.hasPermi('system:config:query')",
                "createConfig", "@ss.hasPermi('system:config:edit')",
                "updateConfig", "@ss.hasPermi('system:config:edit')",
                "deleteConfig", "@ss.hasPermi('system:config:edit')");

        for (Map.Entry<String, String> entry : expected.entrySet()) {
            Method method = findMethod(entry.getKey());
            PreAuthorize preAuthorize = method.getAnnotation(PreAuthorize.class);
            assertNotNull(preAuthorize, entry.getKey() + " should declare @PreAuthorize");
            assertEquals(entry.getValue(), preAuthorize.value());
        }
    }

    @Test
    @DisplayName("Provider list never exposes OAuth app secrets")
    void providersShouldNotExposeAppSecret() throws Exception {
        OAuth2Controller controller = controller();
        OAuthConfig config = oauthConfig();
        config.setId(1L);
        config.setEnabled(1);
        config.setRemark("钉钉登录");
        when(oauthConfigService.getEnabled()).thenReturn(List.of(config));

        var result = controller.getProviders();
        String json = new ObjectMapper().writeValueAsString(result.getData());

        assertThat(json).contains("DINGTALK", "secretConfigured");
        assertThat(json).doesNotContain("app-secret", "appSecret");
    }

    @Test
    @DisplayName("Callback signs JWT with department tenant id")
    void callbackSignsJwtWithDepartmentTenantId() throws Exception {
        OAuth2Controller controller = controller();
        when(oauthConfigService.getByProvider("DINGTALK")).thenReturn(oauthConfig());
        when(restTemplate.getForEntity(any(String.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("access_token", "access-token")))
                .thenReturn(ResponseEntity.ok(Map.of("unionid", "alice")));
        User user = user(42L);
        when(userMapper.selectOne(any())).thenReturn(user);
        when(jwtUtil.generateToken("alice", 7L, "dept:42")).thenReturn("signed-token");

        MockHttpServletResponse response = new MockHttpServletResponse();
        controller.callback("dingtalk", "auth-code", null, response);

        assertThat(response.getRedirectedUrl())
                .isEqualTo("http://localhost:5173/oauth2/callback?token=signed-token&username=alice");
        verify(jwtUtil).generateToken("alice", 7L, "dept:42");
    }

    @Test
    @DisplayName("Callback refuses to sign JWT when user has no department tenant")
    void callbackRejectsUserWithoutDepartmentTenant() throws Exception {
        OAuth2Controller controller = controller();
        when(oauthConfigService.getByProvider("DINGTALK")).thenReturn(oauthConfig());
        when(restTemplate.getForEntity(any(String.class), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of("access_token", "access-token")))
                .thenReturn(ResponseEntity.ok(Map.of("unionid", "alice")));
        when(userMapper.selectOne(any())).thenReturn(user(null));

        MockHttpServletResponse response = new MockHttpServletResponse();
        controller.callback("dingtalk", "auth-code", null, response);

        assertThat(response.getRedirectedUrl())
                .isEqualTo("http://localhost:5173/login?error=oauth_tenant_missing");
        verify(jwtUtil, never()).generateToken(any(), any(), any());
    }

    private OAuth2Controller controller() {
        OAuth2Controller controller = new OAuth2Controller(oauthConfigService, userMapper, jwtUtil, restTemplate);
        ReflectionTestUtils.setField(controller, "frontendUrl", "http://localhost:5173");
        return controller;
    }

    private Method findMethod(String methodName) throws Exception {
        for (Method method : OAuth2Controller.class.getDeclaredMethods()) {
            if (method.getName().equals(methodName)) {
                return method;
            }
        }
        throw new NoSuchMethodException("OAuth2Controller." + methodName);
    }

    private OAuthConfig oauthConfig() {
        OAuthConfig config = new OAuthConfig();
        config.setProvider("DINGTALK");
        config.setAppId("app-id");
        config.setAppSecret("app-secret");
        return config;
    }

    private User user(Long deptId) {
        User user = new User();
        user.setId(7L);
        user.setUsername("alice");
        user.setDeptId(deptId);
        return user;
    }
}
