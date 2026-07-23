package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.SupportTicketDTO;
import com.ams.service.TechSupportService;
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

/** 技术支持工单只读 controller。诊断包强制脱敏，全部只读。 */
@RestController
@RequestMapping("/system/tech-support")
@RequiredArgsConstructor
public class TechSupportController {

    private static final String PERMISSION_QUERY = "system:tech-support:query";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final TechSupportService techSupportService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public Result<SupportTicketDTO.PageResult> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String keyword,
            HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(techSupportService.list(status, priority, keyword, page, pageSize));
    }

    @GetMapping("/{id}")
    public Result<SupportTicketDTO> detail(@PathVariable Long id, HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(techSupportService.detail(id));
    }

    @GetMapping("/meta")
    public Result<SupportTicketDTO.Meta> meta(HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(techSupportService.meta());
    }

    private void requirePermission(HttpServletRequest request, String permission) {
        if (jwtUtil.getUserIdFromToken(extractToken(request)) == null) {
            throw new AccessDeniedException("缺少技术支持工单查询权限");
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("缺少技术支持工单查询权限");
        }
        if (!hasPermission(authentication, permission)) {
            throw new AccessDeniedException("缺少技术支持工单查询权限: " + permission);
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
