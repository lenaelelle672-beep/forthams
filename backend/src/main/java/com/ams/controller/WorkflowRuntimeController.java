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

import java.util.Map;

/**
 * 流程运行时只读查询。
 *
 * <p>提供 /workflow-runtime/{businessType}/start-availability，回答某业务类型当前能否发起流程。
 * 这是流程平台与资产转移等业务页面的发起闸门：前端依赖此端点决定提交按钮是否可用。
 * 本 controller 全部只读，不修改任何流程定义或运行实例。</p>
 *
 * <p>权限按业务类型映射到最小的发起动作权限。运行时读取只使用当前租户的已发布快照，
 * 不复用流程设计器权限，也不返回草稿。</p>
 */
@RestController
@RequestMapping("/workflow-runtime")
@RequiredArgsConstructor
public class WorkflowRuntimeController {

    private static final String STATUS_PUBLISHED = "PUBLISHED";
    private static final String STATUS_DISABLED = "DISABLED";
    private static final Map<String, String> RUNTIME_PERMISSION_BY_BUSINESS_TYPE = Map.of(
            "ASSET_TRANSFER", "disposal:create",
            "ASSET_CLEARANCE", "disposal:create",
            "ASSET_SCRAP", "disposal:create",
            "ASSET_COMPENSATION", "compensation:create",
            "RETIREMENT", "retirement:create",
            "WORK_ORDER", "workorder:submit"
    );

    private final WorkflowDefinitionService workflowDefinitionService;
    private final WorkflowAssigneePreviewService workflowAssigneePreviewService;
    private final JwtUtil jwtUtil;

    @GetMapping("/{businessType}/start-availability")
    public Result<WorkflowStartAvailabilityDTO> startAvailability(
            @PathVariable String businessType, HttpServletRequest request) {
        requireRuntimePermission(businessType, request);
        WorkflowDefinitionDTO definition = workflowDefinitionService.getDefinition(businessType);
        return Result.success(resolveAvailability(businessType, definition));
    }

    @PostMapping("/{businessType}/assignees/preview")
    public Result<WorkflowAssigneePreviewDTO.Response> previewRuntimeAssignees(
            @PathVariable String businessType,
            @RequestBody(required = false) WorkflowAssigneePreviewDTO.Request dto,
            HttpServletRequest request) {
        requireRuntimePermission(businessType, request);
        // 运行时只接受客户端业务数据；无论客户端是否传 definition，都必须使用已发布快照。
        WorkflowDefinitionDTO definition = workflowDefinitionService.getDefinition(businessType);
        if (definition == null || !STATUS_PUBLISHED.equals(definition.getStatus())) {
            WorkflowAssigneePreviewDTO.Response unavailable = new WorkflowAssigneePreviewDTO.Response();
            unavailable.setBusinessType(businessType);
            unavailable.setCalculable(false);
            unavailable.setReason("该业务类型尚未发布可用流程");
            return Result.success(unavailable);
        }
        WorkflowAssigneePreviewDTO.Request previewRequest = dto == null ? new WorkflowAssigneePreviewDTO.Request() : dto;
        previewRequest.setDefinition(definition.getDefinition());
        return Result.success(workflowAssigneePreviewService.previewPublished(
                businessType, previewRequest.getDefinition(), previewRequest.getBusinessData()));
    }

    private WorkflowStartAvailabilityDTO resolveAvailability(String businessType, WorkflowDefinitionDTO definition) {
        if (definition == null) {
            return WorkflowStartAvailabilityDTO.block(businessType, "UNCONFIGURED", 0, null,
                    "该业务类型尚未发布可用流程");
        }
        String status = definition.getStatus();
        if (STATUS_PUBLISHED.equals(status)) {
            return WorkflowStartAvailabilityDTO.allow(businessType, definition.getVersion(), definition.getId());
        }
        if (STATUS_DISABLED.equals(status)) {
            return WorkflowStartAvailabilityDTO.block(businessType, status, definition.getVersion(), definition.getId(),
                    "流程定义已停用，请联系管理员启用");
        }
        return WorkflowStartAvailabilityDTO.block(businessType, "UNCONFIGURED", 0, null,
                "该业务类型尚未发布可用流程");
    }

    private void requireRuntimePermission(String businessType, HttpServletRequest request) {
        String permission = RUNTIME_PERMISSION_BY_BUSINESS_TYPE.get(businessType);
        if (permission == null) {
            throw new AccessDeniedException("不支持的流程运行时业务类型");
        }
        requirePermission(request, permission);
    }

    private void requirePermission(HttpServletRequest request, String permission) {
        requireCurrentUserId(request);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("缺少流程运行时业务权限: " + permission);
        }
        if (!hasPermission(authentication, permission)) {
            throw new AccessDeniedException("缺少流程运行时业务权限: " + permission);
        }
    }

    private boolean hasPermission(Authentication authentication, String permission) {
        if (!authentication.isAuthenticated()) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(permission::equals);
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AccessDeniedException("缺少流程运行时业务权限");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new AccessDeniedException("缺少流程运行时业务权限");
        }
        return userId;
    }
}
