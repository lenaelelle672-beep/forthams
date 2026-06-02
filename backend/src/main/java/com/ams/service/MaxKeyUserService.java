package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.User;
import com.ams.mapper.UserMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;

/**
 * MaxKey SSO 账号同步服务。
 *
 * <p>当前最小安全实现只允许已存在、启用且绑定部门的本地用户通过 SSO。
 * 未完成自动建号和属性同步前，禁止把 OAuth2 身份当作本地账号假成功。</p>
 */
@Service
@Profile("oauth2")
@RequiredArgsConstructor
public class MaxKeyUserService {

    private final UserMapper userMapper;

    /**
     * 校验 MaxKey 返回的 OIDC 用户能否映射到本地启用账号。
     *
     * @param oidcUser MaxKey OIDC 用户
     * @return 本地启用用户
     */
    public User validateSsoUser(OidcUser oidcUser) {
        if (oidcUser == null) {
            throw new BusinessException("SSO 用户信息为空");
        }
        String username = oidcUser.getAttribute("username");
        if (username == null || username.isBlank()) {
            username = oidcUser.getName();
        }
        if (username == null || username.isBlank()) {
            throw new BusinessException("SSO 用户缺少用户名");
        }

        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>()
                        .eq(User::getUsername, username)
                        .eq(User::getStatus, 1)
                        .eq(User::getDeleted, 0)
                        .last("LIMIT 1")
        );
        if (user == null) {
            throw new BusinessException("SSO 用户未绑定本地账号");
        }
        if (user.getDeptId() == null) {
            throw new BusinessException("SSO 用户未绑定部门，无法生成租户令牌");
        }
        return user;
    }
}
