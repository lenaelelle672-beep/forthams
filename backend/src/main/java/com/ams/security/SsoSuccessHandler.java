package com.ams.security;

import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.utils.JwtUtil;
import com.ams.entity.User;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * OAuth2 / SSO 登录成功处理器。
 *
 * <p>Spring Security oauth2Login 成功后触发：从 OAuth2User 提取 username，
 * 查找本地用户 → 签发 JWT → 重定向到前端回调页面（携带 token）。
 */
@Component
public class SsoSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;
    private final JwtUtil jwtUtil;

    @Value("${sso.redirect.frontend:http://localhost:5173/sso-callback}")
    private String frontendCallbackUrl;

    public SsoSuccessHandler(UserMapper userMapper, UserRoleMapper userRoleMapper, JwtUtil jwtUtil) {
        this.userMapper = userMapper;
        this.userRoleMapper = userRoleMapper;
        this.jwtUtil = jwtUtil;
        setAlwaysUseDefaultTargetUrl(false);
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        if (authentication instanceof OAuth2AuthenticationToken oauthToken) {
            String username = oauthToken.getPrincipal().getAttribute("username");
            if (username == null) {
                username = oauthToken.getPrincipal().getName();
            }

            User user = userMapper.selectOne(
                    new LambdaQueryWrapper<User>()
                            .eq(User::getUsername, username)
                            .eq(User::getStatus, 1)
                            .eq(User::getDeleted, 0)
            );

            if (user != null) {
                List<String> roles = userRoleMapper.selectRoleCodesByUserId(user.getId());
                String tenantId = user.getDeptId() != null ? "dept:" + user.getDeptId() : null;
                String jwt = jwtUtil.generateToken(user.getUsername(), user.getId(), tenantId);

                response.sendRedirect(frontendCallbackUrl
                        + "?token=" + jwt
                        + "&userId=" + user.getId()
                        + "&username=" + URLEncoder.encode(user.getUsername(), StandardCharsets.UTF_8)
                        + "&realName=" + URLEncoder.encode(user.getRealName() != null ? user.getRealName() : "", StandardCharsets.UTF_8)
                        + "&roles=" + URLEncoder.encode(String.join(",", roles), StandardCharsets.UTF_8)
                );
                return;
            }
        }
        response.sendRedirect(frontendCallbackUrl + "?error=user_not_found");
    }
}
