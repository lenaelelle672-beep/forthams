package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.FlowDesignerDraftDTO;
import com.ams.dto.FlowDesignerGraphDTO;
import com.ams.dto.FlowDesignerOperationDTO;
import com.ams.dto.FlowDesignerValidationResultDTO;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowDefinitionVersionDTO;
import com.ams.dto.WorkflowStatusUpdateDTO;
import com.ams.dto.WorkflowAssigneePreviewDTO;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/workflows")
@RequiredArgsConstructor
public class WorkflowDefinitionController {

    private static final String PERMISSION_QUERY = "system:flow:query";
    private static final String PERMISSION_EDIT = "workflow:designer:edit";
    private static final String PERMISSION_PUBLISH = "workflow:designer:publish";
    private static final String PERMISSION_ROLLBACK = "workflow:designer:rollback";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final WorkflowDefinitionService workflowDefinitionService;
    private final WorkflowAssigneePreviewService workflowAssigneePreviewService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public Result<List<WorkflowDefinitionDTO>> list(HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(workflowDefinitionService.listDefinitions());
    }

    @GetMapping("/{businessType}")
    public Result<WorkflowDefinitionDTO> get(@PathVariable String businessType, HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(workflowDefinitionService.getDefinition(businessType));
    }

    @GetMapping("/{businessType}/designer")
    public Result<WorkflowDefinitionDTO> getDesigner(@PathVariable String businessType, HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(workflowDefinitionService.getDefinition(businessType));
    }

    @PutMapping("/{businessType}/draft")
    public Result<WorkflowDefinitionDTO> saveDraft(
            @PathVariable String businessType,
            @RequestBody WorkflowDefinitionSaveDTO dto,
            HttpServletRequest request) {
        dto.setOperatorId(requirePermission(request, PERMISSION_EDIT));
        return Result.success(workflowDefinitionService.saveDraft(businessType, dto));
    }

    @PutMapping("/{businessType}/designer/draft")
    public Result<WorkflowDefinitionDTO> saveDesignerDraft(
            @PathVariable String businessType,
            @RequestBody FlowDesignerDraftDTO dto,
            HttpServletRequest request) {
        Long operatorId = requirePermission(request, PERMISSION_EDIT);
        return Result.success(workflowDefinitionService.saveDesignerDraft(businessType, dto, operatorId));
    }

    @PostMapping("/{businessType}/designer/validate")
    public Result<FlowDesignerValidationResultDTO> validateDesignerGraph(
            @PathVariable String businessType,
            @RequestBody FlowDesignerGraphDTO dto,
            HttpServletRequest request) {
        requirePermission(request, PERMISSION_EDIT);
        return Result.success(workflowDefinitionService.validateDesignerGraph(dto));
    }

    @PostMapping("/{businessType}/assignees/preview")
    public Result<WorkflowAssigneePreviewDTO.Response> previewAssignees(
            @PathVariable String businessType,
            @RequestBody(required = false) WorkflowAssigneePreviewDTO.Request dto,
            HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(workflowAssigneePreviewService.preview(businessType, dto));
    }

    @PostMapping("/{businessType}/publish")
    public Result<WorkflowDefinitionDTO> publish(
            @PathVariable String businessType,
            @RequestBody(required = false) FlowDesignerOperationDTO dto,
            HttpServletRequest request) {
        FlowDesignerOperationDTO operation = dto == null ? new FlowDesignerOperationDTO() : dto;
        operation.setOperatorId(requirePermission(request, PERMISSION_PUBLISH));
        return Result.success(workflowDefinitionService.publish(businessType, operation));
    }

    @GetMapping("/{businessType}/versions")
    public Result<List<WorkflowDefinitionVersionDTO>> listVersions(
            @PathVariable String businessType,
            HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(workflowDefinitionService.listVersions(businessType));
    }

    @GetMapping("/{businessType}/versions/{version}")
    public Result<WorkflowDefinitionVersionDTO> getVersion(
            @PathVariable String businessType,
            @PathVariable Integer version,
            HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(workflowDefinitionService.getVersion(businessType, version));
    }

    @PostMapping("/{businessType}/versions/{version}/rollback")
    public Result<WorkflowDefinitionDTO> rollback(
            @PathVariable String businessType,
            @PathVariable Integer version,
            @RequestBody FlowDesignerOperationDTO dto,
            HttpServletRequest request) {
        FlowDesignerOperationDTO operation = dto == null ? new FlowDesignerOperationDTO() : dto;
        operation.setOperatorId(requirePermission(request, PERMISSION_ROLLBACK));
        return Result.success(workflowDefinitionService.rollback(businessType, version, operation));
    }

    @PostMapping("/{businessType}/status")
    public Result<WorkflowDefinitionDTO> updateStatus(
            @PathVariable String businessType,
            @RequestBody WorkflowStatusUpdateDTO dto,
            HttpServletRequest request) {
        dto.setOperatorId(requirePermission(request, PERMISSION_EDIT));
        return Result.success(workflowDefinitionService.updateStatus(businessType, dto));
    }

    private Long requirePermission(HttpServletRequest request, String permission) {
        Long userId = requireCurrentUserId(request);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("缺少流程设计器权限: " + permission);
        }
        if (hasPermission(authentication, permission)) {
            return userId;
        }
        throw new AccessDeniedException("缺少流程设计器权限: " + permission);
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
            throw new AccessDeniedException("缺少流程设计器权限");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new AccessDeniedException("缺少流程设计器权限");
        }
        return userId;
    }
}
