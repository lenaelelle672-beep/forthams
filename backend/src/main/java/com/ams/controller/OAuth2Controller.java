package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.OAuthConfig;
import com.ams.service.OAuthConfigService;
import com.ams.utils.JwtUtil;
import com.ams.mapper.UserMapper;
import com.ams.entity.User;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/oauth2")
@RequiredArgsConstructor
public class OAuth2Controller {

    private final OAuthConfigService oauthConfigService;
    private final UserMapper userMapper;
    private final JwtUtil jwtUtil;
    private final RestTemplate restTemplate;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    // 钉钉 OAuth2 端点
    private static final String DINGTALK_AUTH_URL = "https://login.dingtalk.com/login/qrcode.htm";
    private static final String DINGTALK_TOKEN_URL = "https://oapi.dingtalk.com/gettoken";
    private static final String DINGTALK_USERINFO_URL = "https://oapi.dingtalk.com/getuserinfo";

    // 企业微信 OAuth2 端点
    private static final String WECHAT_AUTH_URL = "https://open.work.weixin.qq.com/wwopen/sso/qrConnect";
    private static final String WECHAT_TOKEN_URL = "https://qyapi.weixin.qq.com/cgi-bin/gettoken";
    private static final String WECHAT_USERINFO_URL = "https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo";

    /**
     * 获取第三方登录授权URL
     */
    @GetMapping("/{provider}/authorize")
    public void authorize(@PathVariable String provider, HttpServletResponse response) throws IOException {
        OAuthConfig config = oauthConfigService.getByProvider(provider.toUpperCase());
        if (config == null) {
            response.sendError(404, "未配置的OAuth2提供商: " + provider);
            return;
        }

        String authUrl;
        String redirectUri = config.getRedirectUrl();
        if (redirectUri == null || redirectUri.isBlank()) {
            redirectUri = frontendUrl + "/oauth2/callback/" + provider;
        }

        switch (provider.toUpperCase()) {
            case "DINGTALK":
                authUrl = DINGTALK_AUTH_URL + "?appid=" + config.getAppId()
                        + "&response_type=code&scope=snsapi_login"
                        + "&redirect_uri=" + URLEncoder.encode(redirectUri, StandardCharsets.UTF_8)
                        + "&state=d_" + System.currentTimeMillis();
                break;
            case "WECHAT":
            case "QIWEI":
                authUrl = WECHAT_AUTH_URL + "?appid=" + config.getAppId()
                        + "&agentid=" + config.getAppId()
                        + "&redirect_uri=" + URLEncoder.encode(redirectUri, StandardCharsets.UTF_8)
                        + "&state=w_" + System.currentTimeMillis();
                break;
            default:
                response.sendError(400, "不支持的OAuth2提供商: " + provider);
                return;
        }

        response.sendRedirect(authUrl);
    }

    /**
     * OAuth2 回调处理
     */
    @GetMapping("/{provider}/callback")
    public void callback(@PathVariable String provider,
                         @RequestParam String code,
                         @RequestParam(required = false) String state,
                         HttpServletResponse response) throws IOException {
        try {
            OAuthConfig config = oauthConfigService.getByProvider(provider.toUpperCase());
            if (config == null) {
                response.sendError(404, "未配置的OAuth2提供商");
                return;
            }

            String username = null;
            switch (provider.toUpperCase()) {
                case "DINGTALK":
                    username = handleDingTalkCallback(config, code);
                    break;
                case "WECHAT":
                case "QIWEI":
                    username = handleWeChatCallback(config, code);
                    break;
                default:
                    response.sendError(400, "不支持的提供商");
                    return;
            }

            if (username == null) {
                response.sendRedirect(frontendUrl + "/login?error=oauth_user_not_found");
                return;
            }

            // 查找本地用户
            User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getUsername, username));
            if (user == null) {
                // 自动创建用户或拒绝
                response.sendRedirect(frontendUrl + "/login?error=oauth_user_not_bound");
                return;
            }

            // 签发 JWT
            String token = jwtUtil.generateToken(user.getUsername(), user.getId(),
                    "default");

            // 重定向到前端回调页
            response.sendRedirect(frontendUrl + "/oauth2/callback?token=" + token
                    + "&username=" + URLEncoder.encode(user.getUsername(), StandardCharsets.UTF_8));

        } catch (Exception e) {
            log.error("oauth2_callback_error provider={} error={}", provider, e.getMessage(), e);
            response.sendRedirect(frontendUrl + "/login?error=oauth_failed");
        }
    }

    /**
     * 获取已启用的第三方登录列表（前端用）
     */
    @GetMapping("/providers")
    public Result<List<OAuthConfig>> getProviders() {
        return Result.success(oauthConfigService.getEnabled());
    }

    /**
     * OAuth2 配置 CRUD（管理员）
     */
    @GetMapping("/config")
    public Result<List<OAuthConfig>> listConfig() {
        return Result.success(oauthConfigService.listAll());
    }

    @PostMapping("/config")
    public Result<OAuthConfig> createConfig(@RequestBody OAuthConfig config) {
        return Result.success(oauthConfigService.create(config));
    }

    @PutMapping("/config/{id}")
    public Result<OAuthConfig> updateConfig(@PathVariable Long id, @RequestBody OAuthConfig config) {
        return Result.success(oauthConfigService.update(id, config));
    }

    @DeleteMapping("/config/{id}")
    public Result<Void> deleteConfig(@PathVariable Long id) {
        oauthConfigService.delete(id);
        return Result.success();
    }

    // ==================== 私有方法 ====================

    private String handleDingTalkCallback(OAuthConfig config, String code) {
        try {
            // 获取 access_token
            String tokenUrl = DINGTALK_TOKEN_URL + "?appkey=" + config.getAppId()
                    + "&appsecret=" + config.getAppSecret();
            ResponseEntity<Map> tokenResp = restTemplate.getForEntity(tokenUrl, Map.class);
            String accessToken = (String) tokenResp.getBody().get("access_token");

            // 获取用户信息
            String userInfoUrl = DINGTALK_USERINFO_URL + "?access_token=" + accessToken + "&code=" + code;
            ResponseEntity<Map> userResp = restTemplate.getForEntity(userInfoUrl, Map.class);
            String unionId = (String) userResp.getBody().get("unionid");
            return unionId; // 用 unionId 映射到本地用户名
        } catch (Exception e) {
            log.error("dingtalk_callback_error {}", e.getMessage());
            return null;
        }
    }

    private String handleWeChatCallback(OAuthConfig config, String code) {
        try {
            String tokenUrl = WECHAT_TOKEN_URL + "?corpid=" + config.getAppId()
                    + "&corpsecret=" + config.getAppSecret();
            ResponseEntity<Map> tokenResp = restTemplate.getForEntity(tokenUrl, Map.class);
            String accessToken = (String) tokenResp.getBody().get("access_token");

            String userInfoUrl = WECHAT_USERINFO_URL + "?access_token=" + accessToken + "&code=" + code;
            ResponseEntity<Map> userResp = restTemplate.getForEntity(userInfoUrl, Map.class);
            String userId = (String) userResp.getBody().get("UserId");
            return userId;
        } catch (Exception e) {
            log.error("wechat_callback_error {}", e.getMessage());
            return null;
        }
    }
}
