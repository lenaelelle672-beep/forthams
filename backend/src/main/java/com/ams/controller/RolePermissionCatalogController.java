package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.RolePermissionCatalogDTO;
import com.ams.service.RolePermissionCatalogService;
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

@RestController
@RequestMapping("/system/role-permissions")
@RequiredArgsConstructor
public class RolePermissionCatalogController {

    private static final String PERMISSION_QUERY = "system:role-permission:query";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final RolePermissionCatalogService rolePermissionCatalogService;
    private final JwtUtil jwtUtil;

    @GetMapping("/catalog")
    public Result<RolePermissionCatalogDTO> getCatalog(HttpServletRequest request) {
        requirePermission(request);
        return Result.success(rolePermissionCatalogService.getCatalog());
    }

    private Long requirePermission(HttpServletRequest request) {
        Long userId = requireCurrentUserId(request);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("缺少角色权限目录查询权限");
        }
        if (hasPermission(authentication)) {
            return userId;
        }
        throw new AccessDeniedException("缺少角色权限目录查询权限");
    }

    private boolean hasPermission(Authentication authentication) {
        if (!authentication.isAuthenticated()) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority -> PERMISSION_QUERY.equals(authority) || ROLE_SUPER_ADMIN.equals(authority));
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AccessDeniedException("缺少角色权限目录查询权限");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new AccessDeniedException("缺少角色权限目录查询权限");
        }
        return userId;
    }
}
