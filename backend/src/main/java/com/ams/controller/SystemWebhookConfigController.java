package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.SystemWebhookConfigRequest;
import com.ams.dto.SystemWebhookConfigResponse;
import com.ams.dto.SystemWebhookConfigTestResponse;
import com.ams.service.SystemWebhookConfigService;
import com.ams.utils.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/system/webhook-configs")
@RequiredArgsConstructor
public class SystemWebhookConfigController {

    private static final String PERMISSION_QUERY = "system:integration:query";
    private static final String PERMISSION_EDIT = "system:integration:edit";
    private static final String PERMISSION_DELETE = "system:integration:delete";
    private static final String PERMISSION_TEST = "system:integration:test";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final SystemWebhookConfigService webhookConfigService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public Result<List<SystemWebhookConfigResponse>> list(HttpServletRequest httpRequest) {
        requirePermission(httpRequest, PERMISSION_QUERY);
        return Result.success(webhookConfigService.list());
    }

    @GetMapping("/{id}")
    public Result<SystemWebhookConfigResponse> get(@PathVariable Long id, HttpServletRequest httpRequest) {
        requirePermission(httpRequest, PERMISSION_QUERY);
        return Result.success(webhookConfigService.get(id));
    }

    @PostMapping
    public Result<SystemWebhookConfigResponse> create(@RequestBody SystemWebhookConfigRequest request,
                                                      HttpServletRequest httpRequest) {
        requirePermission(httpRequest, PERMISSION_EDIT);
        return Result.success(webhookConfigService.create(request));
    }

    @PutMapping("/{id}")
    public Result<SystemWebhookConfigResponse> update(@PathVariable Long id,
                                                      @RequestBody SystemWebhookConfigRequest request,
                                                      HttpServletRequest httpRequest) {
        requirePermission(httpRequest, PERMISSION_EDIT);
        return Result.success(webhookConfigService.update(id, request));
    }

    @PutMapping("/{id}/status")
    public Result<SystemWebhookConfigResponse> updateStatus(@PathVariable Long id,
                                                            @RequestParam Boolean enabled,
                                                            HttpServletRequest httpRequest) {
        requirePermission(httpRequest, PERMISSION_EDIT);
        return Result.success(webhookConfigService.updateStatus(id, Boolean.TRUE.equals(enabled)));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id, HttpServletRequest httpRequest) {
        requirePermission(httpRequest, PERMISSION_DELETE);
        webhookConfigService.delete(id);
        return Result.success(null);
    }

    @PostMapping("/{id}/test")
    public Result<SystemWebhookConfigTestResponse> test(@PathVariable Long id, HttpServletRequest httpRequest) {
        requirePermission(httpRequest, PERMISSION_TEST);
        return Result.success(webhookConfigService.testConfig(id));
    }

    private Long requirePermission(HttpServletRequest request, String permission) {
        Long userId = requireCurrentUserId(request);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("缺少系统集成权限: " + permission);
        }
        if (hasPermission(authentication, permission)) {
            return userId;
        }
        throw new AccessDeniedException("缺少系统集成权限: " + permission);
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
            throw new AccessDeniedException("缺少系统管理权限");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new AccessDeniedException("缺少系统管理权限");
        }
        return userId;
    }
}
