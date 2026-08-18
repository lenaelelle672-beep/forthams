package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.DataPermissionCatalogDTO;
import com.ams.dto.DataPermissionDeptUpdateDTO;
import com.ams.dto.DataPermissionScopeUpdateDTO;
import com.ams.service.DataPermissionCatalogService;
import com.ams.utils.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 数据权限 catalog controller。
 *
 * GET /system/data-permissions/catalog 展示每个角色的 dataScope 与风险提示。
 * PUT /system/data-permissions/roles/{id}/scope 收紧或调整角色 dataScope。
 * 查询复用 system:role-permission:query，写入要求 system:role-permission:edit。
 */
@RestController
@RequestMapping("/system/data-permissions")
@RequiredArgsConstructor
public class DataPermissionCatalogController {

    private static final String PERMISSION_QUERY = "system:role-permission:query";
    private static final String PERMISSION_EDIT = "system:role-permission:edit";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final DataPermissionCatalogService dataPermissionCatalogService;
    private final JwtUtil jwtUtil;

    @GetMapping("/catalog")
    public Result<DataPermissionCatalogDTO> getCatalog(HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(dataPermissionCatalogService.getCatalog());
    }

    @PutMapping("/roles/{id}/scope")
    public Result<DataPermissionCatalogDTO.RoleDataScope> updateScope(
            @PathVariable Long id,
            @Valid @RequestBody DataPermissionScopeUpdateDTO dto,
            HttpServletRequest request) {
        requirePermission(request, PERMISSION_EDIT);
        return Result.success(dataPermissionCatalogService.updateRoleDataScope(id, dto.getDataScope()));
    }

    @GetMapping("/roles/{id}/depts")
    public Result<DataPermissionCatalogDTO.RoleDataScope> getCustomDepts(
            @PathVariable Long id,
            HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(dataPermissionCatalogService.getRoleCustomDepts(id));
    }

    @PutMapping("/roles/{id}/depts")
    public Result<DataPermissionCatalogDTO.RoleDataScope> updateCustomDepts(
            @PathVariable Long id,
            @Valid @RequestBody DataPermissionDeptUpdateDTO dto,
            HttpServletRequest request) {
        requirePermission(request, PERMISSION_EDIT);
        return Result.success(dataPermissionCatalogService.replaceCustomDepts(id, dto.getDeptIds()));
    }

    private void requirePermission(HttpServletRequest request, String permission) {
        if (jwtUtil.getUserIdFromToken(extractToken(request)) == null) {
            throw new AccessDeniedException("缺少数据权限权限");
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("缺少数据权限权限");
        }
        if (!hasPermission(authentication, permission)) {
            throw new AccessDeniedException("缺少数据权限权限: " + permission);
        }
    }

    private boolean hasPermission(Authentication authentication, String permission) {
        if (!authentication.isAuthenticated()) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority -> permission.equals(authority) || ROLE_SUPER_ADMIN.equals(authority));
    }

    private String extractToken(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AccessDeniedException("缺少有效认证");
        }
        return authHeader.substring(7);
    }
}
