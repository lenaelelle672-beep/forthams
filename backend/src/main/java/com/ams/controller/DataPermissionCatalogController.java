package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.DataPermissionCatalogDTO;
import com.ams.service.DataPermissionCatalogService;
import com.ams.utils.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 数据权限只读 catalog controller。
 *
 * GET /system/data-permissions/catalog 展示每个角色的 dataScope 与风险提示。
 * 复用 system:role-permission:query 权限码（数据权限是角色权限链的一部分）。
 * 全部只读，不提供修改 dataScope 的写操作。
 */
@RestController
@RequestMapping("/system/data-permissions")
@RequiredArgsConstructor
public class DataPermissionCatalogController {

    private static final String PERMISSION_QUERY = "system:role-permission:query";

    private final DataPermissionCatalogService dataPermissionCatalogService;
    private final JwtUtil jwtUtil;

    @GetMapping("/catalog")
    public Result<DataPermissionCatalogDTO> getCatalog(HttpServletRequest request) {
        requirePermission(request);
        return Result.success(dataPermissionCatalogService.getCatalog());
    }

    private void requirePermission(HttpServletRequest request) {
        if (jwtUtil.getUserIdFromToken(extractToken(request)) == null) {
            throw new AccessDeniedException("缺少数据权限查询权限");
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("缺少数据权限查询权限");
        }
        if (!hasPermission(authentication)) {
            throw new AccessDeniedException("缺少数据权限查询权限: " + PERMISSION_QUERY);
        }
    }

    private boolean hasPermission(Authentication authentication) {
        if (!authentication.isAuthenticated()) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(PERMISSION_QUERY::equals);
    }

    private String extractToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AccessDeniedException("缺少有效认证");
        }
        return authHeader.substring(7);
    }
}
