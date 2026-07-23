package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.HandoverDTO;
import com.ams.service.HandoverService;
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
 * 交接任务记录只读 controller。
 *
 * GET /system/handover       交接任务列表（带租户隔离）
 * GET /system/handover/{id}  交接任务详情
 * GET /system/handover/meta  只读元数据
 *
 * 全部只读，不提供发起/推进/取消交接的写操作（V3 只读边界）。
 */
@RestController
@RequestMapping("/system/handover")
@RequiredArgsConstructor
public class HandoverController {

    private static final String PERMISSION_QUERY = "system:handover:query";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final HandoverService handoverService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public Result<HandoverDTO.PageResult> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(handoverService.list(status, keyword, page, pageSize));
    }

    @GetMapping("/{id}")
    public Result<HandoverDTO> detail(@PathVariable Long id, HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(handoverService.detail(id));
    }

    @GetMapping("/meta")
    public Result<HandoverDTO.Meta> meta(HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(handoverService.meta());
    }

    private void requirePermission(HttpServletRequest request, String permission) {
        if (jwtUtil.getUserIdFromToken(extractToken(request)) == null) {
            throw new AccessDeniedException("缺少交接任务查询权限");
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("缺少交接任务查询权限");
        }
        if (!hasPermission(authentication, permission)) {
            throw new AccessDeniedException("缺少交接任务查询权限: " + permission);
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
