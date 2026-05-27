package com.ams.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

/**
 * MaxKey SSO / OAuth2 OidcUserService 配置。
 *
 * <p>Mock 模式下 OidcUserService 直接透传，不做额外账号同步（由 SsoSuccessHandler 处理本地用户查找与 JWT 签发）。
 * 真实 MaxKey 对接时需替换为 {@code MaxKeyUserService} 实现跨系统账号同步。</p>
 */
@Configuration
public class MaxKeyOAuth2Config {

    @Bean
    public OAuth2UserService<OidcUserRequest, OidcUser> maxKeyOidcUserService() {
        return new OidcUserService();
    }
}
