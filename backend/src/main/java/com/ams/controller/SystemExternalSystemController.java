package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.SystemExternalSystemDTO;
import com.ams.dto.SystemExternalSystemOperationDTO;
import com.ams.dto.SystemExternalSystemSaveDTO;
import com.ams.dto.SystemExternalSystemValidationResultDTO;
import com.ams.service.SystemExternalSystemService;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/system/external-systems")
@RequiredArgsConstructor
public class SystemExternalSystemController {

    private static final String PERMISSION_QUERY = "system:integration:query";
    private static final String PERMISSION_EDIT = "system:integration:edit";
    private static final String PERMISSION_TEST = "system:integration:test";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final SystemExternalSystemService externalSystemService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public Result<List<SystemExternalSystemDTO>> list(@RequestParam(required = false) String keyword,
                                                      @RequestParam(required = false) String systemType,
                                                      @RequestParam(required = false) String status,
                                                      HttpServletRequest httpRequest) {
        requirePermission(httpRequest, PERMISSION_QUERY);
        return Result.success(externalSystemService.list(keyword, systemType, status));
    }

    @GetMapping("/{id}")
    public Result<SystemExternalSystemDTO> get(@PathVariable Long id, HttpServletRequest httpRequest) {
        requirePermission(httpRequest, PERMISSION_QUERY);
        return Result.success(externalSystemService.get(id));
    }

    @PostMapping
    public Result<SystemExternalSystemDTO> create(@RequestBody SystemExternalSystemSaveDTO request,
                                                  HttpServletRequest httpRequest) {
        Long currentUserId = requirePermission(httpRequest, PERMISSION_EDIT);
        return Result.success(externalSystemService.create(request, currentUserId));
    }

    @PutMapping("/{id}")
    public Result<SystemExternalSystemDTO> update(@PathVariable Long id,
                                                  @RequestBody SystemExternalSystemSaveDTO request,
                                                  HttpServletRequest httpRequest) {
        Long currentUserId = requirePermission(httpRequest, PERMISSION_EDIT);
        return Result.success(externalSystemService.update(id, request, currentUserId));
    }

    @PostMapping("/{id}/enable")
    public Result<SystemExternalSystemDTO> enable(@PathVariable Long id,
                                                  @RequestBody SystemExternalSystemOperationDTO request,
                                                  HttpServletRequest httpRequest) {
        Long currentUserId = requirePermission(httpRequest, PERMISSION_EDIT);
        return Result.success(externalSystemService.enable(id, request, currentUserId));
    }

    @PostMapping("/{id}/disable")
    public Result<SystemExternalSystemDTO> disable(@PathVariable Long id,
                                                   @RequestBody SystemExternalSystemOperationDTO request,
                                                   HttpServletRequest httpRequest) {
        Long currentUserId = requirePermission(httpRequest, PERMISSION_EDIT);
        return Result.success(externalSystemService.disable(id, request, currentUserId));
    }

    @PostMapping("/{id}/validate")
    public Result<SystemExternalSystemValidationResultDTO> validate(@PathVariable Long id,
                                                                    @RequestBody(required = false) SystemExternalSystemOperationDTO request,
                                                                    HttpServletRequest httpRequest) {
        Long currentUserId = requirePermission(httpRequest, PERMISSION_TEST);
        return Result.success(externalSystemService.validateConfig(id, request, currentUserId));
    }

    private Long requirePermission(HttpServletRequest request, String permission) {
        Long userId = requireCurrentUserId(request);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("缺少外部系统权限: " + permission);
        }
        if (hasPermission(authentication, permission)) {
            return userId;
        }
        throw new AccessDeniedException("缺少外部系统权限: " + permission);
    }

    private boolean hasPermission(Authentication authentication, String permission) {
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority -> permission.equals(authority) || ROLE_SUPER_ADMIN.equals(authority));
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AccessDeniedException("缺少外部系统登录态");
        }
        Long userId;
        try {
            userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        } catch (Exception e) {
            throw new AccessDeniedException("缺少外部系统登录态");
        }
        if (userId == null) {
            throw new AccessDeniedException("缺少外部系统登录态");
        }
        return userId;
    }
}
