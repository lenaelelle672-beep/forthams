package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.CacheNamespaceStatus;
import com.ams.dto.CacheRefreshResult;
import com.ams.service.CacheManagementService;
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
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/system/cache")
@RequiredArgsConstructor
public class CacheManagementController {

    private static final String PERMISSION_QUERY = "system:cache:query";
    private static final String PERMISSION_REFRESH = "system:cache:refresh";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final CacheManagementService cacheManagementService;
    private final JwtUtil jwtUtil;

    @GetMapping("/namespaces")
    public Result<List<CacheNamespaceStatus>> listNamespaces(HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(cacheManagementService.listNamespaces());
    }

    @PostMapping("/namespaces/{namespace}/refresh")
    public Result<CacheRefreshResult> refreshNamespace(@PathVariable String namespace, HttpServletRequest request) {
        requirePermission(request, PERMISSION_REFRESH);
        return Result.success(cacheManagementService.refreshNamespace(namespace));
    }

    @PostMapping("/refresh")
    public Result<List<CacheRefreshResult>> refreshAll(HttpServletRequest request) {
        requirePermission(request, PERMISSION_REFRESH);
        return Result.success(cacheManagementService.refreshAll());
    }

    private Long requirePermission(HttpServletRequest request, String permission) {
        Long userId = requireCurrentUserId(request);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("缺少缓存管理权限: " + permission);
        }
        if (hasPermission(authentication, permission)) {
            return userId;
        }
        throw new AccessDeniedException("缺少缓存管理权限: " + permission);
    }

    private boolean hasPermission(Authentication authentication, String permission) {
        if (!authentication.isAuthenticated()) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority -> permission.equals(authority) || ROLE_SUPER_ADMIN.equals(authority));
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AccessDeniedException("缺少缓存管理权限");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new AccessDeniedException("缺少缓存管理权限");
        }
        return userId;
    }
}
