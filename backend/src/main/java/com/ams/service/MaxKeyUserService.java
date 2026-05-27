package com.ams.service;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

/**
 * MaxKey SSO 账号同步服务（骨架）。
 *
 * <p>仅在 {@code oauth2} profile 激活时生效。
 * 对接时需实现：
 * <ul>
 *   <li>从 OAuth2 {@code OidcUser} 提取 username/realName/email/phone</li>
 *   <li>按 username 查找本地用户，不存在则自动创建（auto-create-user=true）</li>
 *   <li>创建时分配默认角色（default-role-id）和默认部门（default-dept-id）</li>
 *   <li>已存在用户按配置更新字段（sync-attributes）</li>
 *   <li>同步完成后签发 JWT 令牌</li>
 * </ul>
 *
 * <p>TODO: 完整对接时实现上述逻辑，注入
 * {@code UserMapper}/{@code UserRoleMapper}/{@code DeptMapper}/{@code JwtUtil}。</p>
 */
@Service
@Profile("oauth2")
public class MaxKeyUserService {

    // TODO: 实现账号同步逻辑
    // public String syncAndIssueToken(OidcUser oidcUser) {
    //     String username = oidcUser.getAttribute("username");
    //     User user = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getUsername, username));
    //     if (user == null && autoCreateUser) {
    //         user = createLocalUser(oidcUser);
    //     }
    //     return jwtUtil.generateToken(user.getUsername(), user.getId(), "dept:" + user.getDeptId());
    // }
}
