package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.ImportExportTaskDTO;
import com.ams.service.ImportExportTaskService;
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
 * 导入导出任务记录只读 controller。
 *
 * GET /system/import-export/tasks      任务历史列表（带租户隔离）
 * GET /system/import-export/tasks/{id} 任务详情
 * GET /system/import-export/meta       只读元数据
 *
 * 全部只读，不提供执行导入/导出的写操作（V3 只读边界）。
 */
@RestController
@RequestMapping("/system/import-export")
@RequiredArgsConstructor
public class ImportExportTaskController {

    private static final String PERMISSION_QUERY = "system:import-export:query";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final ImportExportTaskService importExportTaskService;
    private final JwtUtil jwtUtil;

    @GetMapping("/tasks")
    public Result<ImportExportTaskDTO.PageResult> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String taskType,
            @RequestParam(required = false) String businessObject,
            @RequestParam(required = false) String status,
            HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(importExportTaskService.list(taskType, businessObject, status, page, pageSize));
    }

    @GetMapping("/tasks/{id}")
    public Result<ImportExportTaskDTO> detail(@PathVariable Long id, HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(importExportTaskService.detail(id));
    }

    @GetMapping("/meta")
    public Result<ImportExportTaskDTO.Meta> meta(HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(importExportTaskService.meta());
    }

    private void requirePermission(HttpServletRequest request, String permission) {
        if (jwtUtil.getUserIdFromToken(extractToken(request)) == null) {
            throw new AccessDeniedException("缺少导入导出任务查询权限");
        }
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("缺少导入导出任务查询权限");
        }
        if (!hasPermission(authentication, permission)) {
            throw new AccessDeniedException("缺少导入导出任务查询权限: " + permission);
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
