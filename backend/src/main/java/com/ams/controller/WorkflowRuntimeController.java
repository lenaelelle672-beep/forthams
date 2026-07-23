package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.WorkflowAssigneePreviewDTO;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowStartAvailabilityDTO;
import com.ams.service.WorkflowAssigneePreviewService;
import com.ams.service.WorkflowDefinitionService;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 流程运行时只读查询。
 *
 * <p>提供 /workflow-runtime/{businessType}/start-availability，回答某业务类型当前能否发起流程。
 * 这是流程平台与资产转移等业务页面的发起闸门：前端依赖此端点决定提交按钮是否可用。
 * 本 controller 全部只读，不修改任何流程定义或运行实例。</p>
 *
 * <p>权限：复用 system:flow:query（与流程定义查看同一权限码），因为发起可用性本质上是
 * 查看流程定义状态派生的只读结果。</p>
 */
@RestController
@RequestMapping("/workflow-runtime")
@RequiredArgsConstructor
public class WorkflowRuntimeController {

    private static final String PERMISSION_QUERY = "system:flow:query";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";
    private static final String STATUS_PUBLISHED = "PUBLISHED";
    private static final String STATUS_DISABLED = "DISABLED";

    private final WorkflowDefinitionService workflowDefinitionService;
    private final WorkflowAssigneePreviewService workflowAssigneePreviewService;
    private final JwtUtil jwtUtil;

    @GetMapping("/{businessType}/start-availability")
    public Result<WorkflowStartAvailabilityDTO> startAvailability(
            @PathVariable String businessType, HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        WorkflowDefinitionDTO definition = workflowDefinitionService.getDefinition(businessType);
        return Result.success(resolveAvailability(businessType, definition));
    }

    @PostMapping("/{businessType}/assignees/preview")
    public Result<WorkflowAssigneePreviewDTO.Response> previewRuntimeAssignees(
            @PathVariable String businessType,
            @RequestBody(required = false) WorkflowAssigneePreviewDTO.Request dto,
            HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        // 运行时预览使用当前已发布定义，合并客户端传入的 businessData
        WorkflowDefinitionDTO definition = workflowDefinitionService.getDefinition(businessType);
        WorkflowAssigneePreviewDTO.Request previewRequest = dto == null ? new WorkflowAssigneePreviewDTO.Request() : dto;
        if (previewRequest.getDefinition() == null) {
            previewRequest.setDefinition(definition.getDefinition());
        }
        return Result.success(workflowAssigneePreviewService.preview(businessType, previewRequest));
    }

    private WorkflowStartAvailabilityDTO resolveAvailability(String businessType, WorkflowDefinitionDTO definition) {
        String status = definition.getStatus();
        if (STATUS_PUBLISHED.equals(status)) {
            return WorkflowStartAvailabilityDTO.allow(businessType, definition.getVersion(), definition.getId());
        }
        String reason;
        if (status == null || status.isBlank()) {
            reason = "该业务类型尚未配置流程定义";
            status = "UNCONFIGURED";
        } else if (STATUS_DISABLED.equals(status)) {
            reason = "流程定义已停用，请联系管理员启用";
        } else {
            // DRAFT 或其他未发布状态
            reason = "流程定义尚未发布，当前不可发起";
        }
        return WorkflowStartAvailabilityDTO.block(businessType, status, definition.getVersion(), definition.getId(), reason);
    }

    private void requirePermission(HttpServletRequest request, String permission) {
        requireCurrentUserId(request);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("缺少流程运行时查询权限: " + permission);
        }
        if (!hasPermission(authentication, permission)) {
            throw new AccessDeniedException("缺少流程运行时查询权限: " + permission);
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

    private Long requireCurrentUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AccessDeniedException("缺少流程运行时查询权限");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new AccessDeniedException("缺少流程运行时查询权限");
        }
        return userId;
    }
}
