package com.ams.controller;

import com.ams.common.Result;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * MaxKey SSO 入口控制器（骨架）。
 *
 * <p>仅在 {@code oauth2} profile 激活时加载。
 * 完整对接完成后由 Spring Security {@code oauth2Login()} 接管，
 * 此 Controller 提供手动 SSO 触发入口。</p>
 *
 * <p>TODO: 对接完成后补充：
 * <ul>
 *   <li>{@code GET /sso/login} → 重定向到 MaxKey authorize 端点</li>
 *   <li>{@code GET /sso/callback} → OAuth2 回调处理 + JWT 签发</li>
 *   <li>{@code GET /sso/userinfo} → 从 MaxKey 拉取用户信息</li>
 * </ul></p>
 */
@RestController
@RequestMapping("/sso")
@Profile("oauth2")
public class MaxKeySsoController {

    @GetMapping("/login")
    public Result<String> login() {
        return Result.success("SSO endpoint not yet configured. Redirect client to /oauth2/authorization/maxkey");
    }

    @GetMapping("/status")
    public Result<String> status() {
        return Result.success("SSO framework loaded (oauth2 profile active). Configure application-oauth2.properties with real MaxKey endpoints.");
    }
}
