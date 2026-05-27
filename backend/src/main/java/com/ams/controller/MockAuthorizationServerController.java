package com.ams.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Mock OAuth2 Authorization Server — 模拟 MaxKey 的 authorize / token / userinfo 端点。
 *
 * <p>仅在 {@code sso.mock.enabled=true} 时加载。
 * 用于本地开发测试，不依赖真实 MaxKey 实例。
 * 授权码模式：GET authorize → 返回临时 code → POST token → 返回 access_token → GET userinfo → 返回用户信息。
 */
@RestController
@RequestMapping("/oauth2-mock")
@ConditionalOnProperty(name = "sso.mock.enabled", havingValue = "true")
public class MockAuthorizationServerController {

    private static final Map<String, String> CODE_STORE = new ConcurrentHashMap<>();

    @Value("${sso.mock.default-username:admin}")
    private String defaultUsername;

    /** GET /api/oauth2-mock/authorize — 模拟授权端点，自动重定向回 redirect_uri 带 code */
    @GetMapping("/authorize")
    public void authorize(@RequestParam("redirect_uri") String redirectUri,
                          @RequestParam(value = "state", required = false) String state,
                          HttpServletResponse response) throws IOException {
        String code = UUID.randomUUID().toString().replace("-", "");
        CODE_STORE.put(code, defaultUsername);
        String location = redirectUri + "?code=" + code;
        if (state != null) {
            location += "&state=" + URLEncoder.encode(state, StandardCharsets.UTF_8);
        }
        response.sendRedirect(location);
    }

    /** POST /api/oauth2-mock/token — 模拟令牌端点，用 code 换取 access_token */
    @PostMapping(value = "/token", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> token(@RequestParam("code") String code) {
        String username = CODE_STORE.remove(code);
        if (username == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "invalid_grant", "error_description", "Authorization code not found or expired"));
        }
        String accessToken = "mock-at-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        CODE_STORE.put(accessToken, username);
        return ResponseEntity.ok(Map.of(
                "access_token", accessToken,
                "token_type", "Bearer",
                "expires_in", 3600,
                "scope", "openid profile email"
        ));
    }

    /** GET /api/oauth2-mock/userinfo — 模拟用户信息端点 */
    @GetMapping(value = "/userinfo", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> userinfo(HttpServletRequest request) {
        String auth = request.getHeader("Authorization");
        String token = auth != null && auth.startsWith("Bearer ") ? auth.substring(7) : null;
        String username = CODE_STORE.get(token);
        if (username == null) {
            username = defaultUsername;
        }
        return Map.of(
                "sub", username,
                "username", username,
                "name", "Mock User",
                "email", username + "@example.com"
        );
    }
}
