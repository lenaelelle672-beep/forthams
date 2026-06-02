package com.ams.config;

import com.ams.service.MaxKeyUserService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

/**
 * MaxKey SSO / OAuth2 OidcUserService 配置。
 *
 * <p>oauth2 profile 激活且存在 MaxKeyUserService 时，OIDC 用户必须映射到本地启用账号；
 * 未映射用户会被安全拒绝，避免空壳账号同步造成假成功。</p>
 */
@Configuration
public class MaxKeyOAuth2Config {

    @Bean
    public OAuth2UserService<OidcUserRequest, OidcUser> maxKeyOidcUserService(
            ObjectProvider<MaxKeyUserService> maxKeyUserServiceProvider) {
        OidcUserService delegate = new OidcUserService();
        return userRequest -> {
            OidcUser oidcUser = delegate.loadUser(userRequest);
            MaxKeyUserService maxKeyUserService = maxKeyUserServiceProvider.getIfAvailable();
            if (maxKeyUserService != null) {
                maxKeyUserService.validateSsoUser(oidcUser);
            }
            return oidcUser;
        };
    }
}
