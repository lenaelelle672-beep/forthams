package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.SysTenantDTO;
import com.ams.service.SysTenantService;
import com.ams.utils.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 租户主数据只读 controller。
 *
 * 路径 /tenants 与前端 api/tenant.ts 现有调用对齐：
 * - GET /tenants          租户目录列表（要求 system:tenant:query 或 ROLE_SUPER_ADMIN）
 * - GET /tenants/current  当前租户（任意已认证用户，供 UserProfilePage）
 * - GET /tenants/{id}     租户详情（要求 system:tenant:query 或 ROLE_SUPER_ADMIN）
 * - GET /tenants/meta     只读元数据（要求 system:tenant:query 或 ROLE_SUPER_ADMIN）
 *
 * 全部只读，不暴露 create/update/suspend/activate（V3 只读 catalog 边界）。
 */
@RestController
@RequestMapping("/tenants")
@RequiredArgsConstructor
public class SysTenantController {

    private static final String PERMISSION_QUERY = "system:tenant:query";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final SysTenantService sysTenantService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public Result<SysTenantDTO.PageResult> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            HttpServletRequest request) {
        requireTenantQueryPermission(request);
        return Result.success(sysTenantService.list(keyword, status, page, pageSize));
    }

    @GetMapping("/current")
    public Result<SysTenantDTO> current(HttpServletRequest request) {
        requireAuthenticated(request);
        return Result.success(sysTenantService.current());
    }

    @GetMapping("/meta")
    public Result<SysTenantDTO.Meta> meta(HttpServletRequest request) {
        requireTenantQueryPermission(request);
        return Result.success(sysTenantService.meta());
    }

    @GetMapping("/{id}")
    public Result<SysTenantDTO> detail(@PathVariable String id, HttpServletRequest request) {
        requireTenantQueryPermission(request);
        return Result.success(sysTenantService.detail(id));
    }

    /** /current 只要求已认证（任何租户用户都能看自己的租户），不要求 tenant:query 权限。 */
    private void requireAuthenticated(HttpServletRequest request) {
        if (jwtUtil.getUserIdFromToken(extractToken(request)) == null) {
            throw new AccessDeniedException("缺少有效认证");
        }
    }

    private void requireTenantQueryPermission(HttpServletRequest request) {
        if (jwtUtil.getUserIdFromToken(extractToken(request)) == null) {
            throw new AccessDeniedException("缺少租户管理查询权限");
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("缺少租户管理查询权限");
        }
        if (!hasPermission(authentication)) {
            throw new AccessDeniedException("缺少租户管理查询权限: " + PERMISSION_QUERY);
        }
    }

    private boolean hasPermission(Authentication authentication) {
        if (!authentication.isAuthenticated()) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority -> PERMISSION_QUERY.equals(authority) || ROLE_SUPER_ADMIN.equals(authority));
    }

    private String extractToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AccessDeniedException("缺少有效认证");
        }
        return authHeader.substring(7);
    }
}
