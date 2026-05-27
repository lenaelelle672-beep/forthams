package com.ams.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;
import java.util.Set;

/**
 * Spring Security 权限校验 Bean（注册为 @Service("ss")），供 @PreAuthorize 注解使用。
 *
 * <p>使用方式：{@code @PreAuthorize("@ss.hasPermi('system:user:list')")}</p>
 *
 * <p>规则（与 RuoYi 行为一致）：</p>
 * <ol>
 *   <li>未登录 → false</li>
 *   <li>SUPER_ADMIN 角色 → true（短路，不需要逐条 perms）</li>
 *   <li>*:*:* 全局通配 → true</li>
 *   <li>精确匹配 permission</li>
 *   <li>支持通配符：system:user:*、system:*:*</li>
 *   <li>空 permission → false</li>
 * </ol>
 */
@Service("ss")
public class SecurityService {

    private static final Logger log = LoggerFactory.getLogger(SecurityService.class);

    /** 超级管理员角色码（唯一短路判断角色） */
    private static final String SUPER_ADMIN_ROLE = "SUPER_ADMIN";

    /** 全局通配权限 */
    private static final String ALL_PERMISSION = "*:*:*";

    @Value("${ams.security.method-permission-test-bypass:false}")
    private boolean methodPermissionTestBypass;

    /**
     * 验证用户是否拥有指定权限。
     *
     * @param permission 权限标识符，如 "system:user:list"
     * @return true=有权限，false=无权限
     */
    public boolean hasPermi(String permission) {
        if (methodPermissionTestBypass) {
            return true;
        }
        if (permission == null || permission.isBlank()) {
            return false;
        }

        LoginUser loginUser = getLoginUser();
        if (loginUser == null) {
            return false;
        }

        // SUPER_ADMIN 角色短路：拥有所有权限
        if (hasSuperAdminRole(loginUser)) {
            return true;
        }

        // 全局通配或精确匹配
        if (ALL_PERMISSION.equals(permission)) {
            return hasPermission(loginUser, ALL_PERMISSION);
        }

        return hasPermission(loginUser, permission);
    }

    /**
     * 验证用户是否拥有指定权限列表中的任意一个。
     *
     * @param permissions 逗号分隔的权限字符串，如 "system:user:add,system:user:edit"
     */
    public boolean hasAnyPermi(String permissions) {
        if (methodPermissionTestBypass) {
            return true;
        }
        if (permissions == null || permissions.isBlank()) {
            return false;
        }

        LoginUser loginUser = getLoginUser();
        if (loginUser == null) {
            return false;
        }

        if (hasSuperAdminRole(loginUser)) {
            return true;
        }

        Set<String> authoritySet = getAuthoritySet(loginUser);
        for (String perm : permissions.split(",")) {
            String trimmed = perm.trim();
            if (authoritySet.contains(ALL_PERMISSION) || authoritySet.contains(trimmed)) {
                return true;
            }
            // 通配符匹配
            if (matchWildcard(authoritySet, trimmed)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 验证用户是否拥有指定权限列表中的所有权限。
     */
    public boolean hasAllPermi(String permissions) {
        if (methodPermissionTestBypass) {
            return true;
        }
        if (permissions == null || permissions.isBlank()) {
            return false;
        }

        LoginUser loginUser = getLoginUser();
        if (loginUser == null) {
            return false;
        }

        if (hasSuperAdminRole(loginUser)) {
            return true;
        }

        Set<String> authoritySet = getAuthoritySet(loginUser);
        for (String perm : permissions.split(",")) {
            String trimmed = perm.trim();
            if (!authoritySet.contains(ALL_PERMISSION)
                    && !authoritySet.contains(trimmed)
                    && !matchWildcard(authoritySet, trimmed)) {
                return false;
            }
        }
        return true;
    }

    /**
     * 验证用户是否拥有指定角色（兼容现有 hasRole 检查）。
     */
    public boolean hasRole(String role) {
        if (methodPermissionTestBypass) {
            return true;
        }
        if (role == null || role.isBlank()) {
            return false;
        }

        LoginUser loginUser = getLoginUser();
        if (loginUser == null) {
            return false;
        }

        List<String> roles = loginUser.getRoles();
        if (roles == null || roles.isEmpty()) {
            return false;
        }

        // 超级管理员角色短路
        if (roles.contains(SUPER_ADMIN_ROLE)) {
            return true;
        }

        return roles.stream().anyMatch(r -> r.equalsIgnoreCase(role));
    }

    // ── 私有辅助方法 ──────────────────────────────────────────────────────

    private LoginUser getLoginUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof LoginUser loginUser) {
            return loginUser;
        }
        return null;
    }

    private boolean hasSuperAdminRole(LoginUser loginUser) {
        List<String> roles = loginUser.getRoles();
        return roles != null && roles.contains(SUPER_ADMIN_ROLE);
    }

    private boolean hasPermission(LoginUser loginUser, String permission) {
        Set<String> authoritySet = getAuthoritySet(loginUser);
        if (authoritySet.contains(ALL_PERMISSION)) {
            return true;
        }
        if (authoritySet.contains(permission)) {
            return true;
        }
        return matchWildcard(authoritySet, permission);
    }

    private Set<String> getAuthoritySet(LoginUser loginUser) {
        List<String> perms = loginUser.getPermissions();
        if (perms == null) {
            return Set.of();
        }
        return Set.copyOf(perms);
    }

    /**
     * 通配符匹配：检查 authority 集合中是否存在匹配 permission 的通配模式。
     *
     * <p>例如：authority 含 "system:user:*" 则匹配 "system:user:list"。</p>
     */
    private boolean matchWildcard(Collection<String> authorities, String permission) {
        if (authorities == null || authorities.isEmpty()) {
            return false;
        }

        String[] parts = permission.split(":");
        if (parts.length < 3) {
            return authorities.contains(permission);
        }

        // 构造所有可能的通配模式：system:user:*、system:*:*
        for (String authority : authorities) {
            if (authority == null || authority.isBlank()) {
                continue;
            }
            if (authority.contains("*") && matchesPattern(authority, permission)) {
                return true;
            }
        }

        return false;
    }

    private boolean matchesPattern(String pattern, String permission) {
        String[] patternParts = pattern.split(":");
        String[] permParts = permission.split(":");

        if (patternParts.length != permParts.length) {
            return false;
        }

        for (int i = 0; i < patternParts.length; i++) {
            if ("*".equals(patternParts[i])) {
                continue;
            }
            if (!patternParts[i].equals(permParts[i])) {
                return false;
            }
        }
        return true;
    }
}
