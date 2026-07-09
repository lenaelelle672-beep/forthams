package com.ams.controller;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.ams.dto.TodoFieldConfigDTO;
import com.ams.dto.TodoFieldOperationDTO;
import com.ams.dto.TodoFieldPreviewDTO;
import com.ams.dto.TodoFieldRoleOverrideDTO;
import com.ams.dto.TodoFieldSaveDTO;
import com.ams.service.TodoFieldConfigService;
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
@RequestMapping("/todo-fields")
@RequiredArgsConstructor
public class TodoFieldConfigController {

    private static final String PERMISSION_LIST = "workflow:todo-field:list";
    private static final String PERMISSION_UPDATE = "workflow:todo-field:update";
    private static final String PERMISSION_RESET = "workflow:todo-field:reset";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final TodoFieldConfigService todoFieldConfigService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public Result<List<TodoFieldConfigDTO>> list(
            @RequestParam(required = false) String roleCode,
            HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_LIST);
        return Result.success(todoFieldConfigService.listFields(roleCode));
    }

    @PutMapping
    public Result<List<TodoFieldConfigDTO>> save(
            @RequestBody(required = false) TodoFieldSaveDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_UPDATE);
        TodoFieldSaveDTO payload = dto == null ? new TodoFieldSaveDTO() : dto;
        requireHighRiskPayload(payload.getConfirmed(), payload.getOperatorId(), currentUserId, payload.getReason(), payload.getAuditEvidence(), "保存待办字段");
        return Result.success(todoFieldConfigService.saveFields(payload));
    }

    @PutMapping("/sort-order")
    public Result<List<TodoFieldConfigDTO>> sortOrder(
            @RequestBody(required = false) TodoFieldSaveDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_UPDATE);
        TodoFieldSaveDTO payload = dto == null ? new TodoFieldSaveDTO() : dto;
        requireHighRiskPayload(payload.getConfirmed(), payload.getOperatorId(), currentUserId, payload.getReason(), payload.getAuditEvidence(), "保存待办字段排序");
        return Result.success(todoFieldConfigService.saveSortOrder(payload));
    }

    @PutMapping("/role-overrides/{roleCode}")
    public Result<List<TodoFieldConfigDTO>> roleOverrides(
            @PathVariable String roleCode,
            @RequestBody(required = false) TodoFieldRoleOverrideDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_UPDATE);
        TodoFieldRoleOverrideDTO payload = dto == null ? new TodoFieldRoleOverrideDTO() : dto;
        payload.setRoleCode(roleCode);
        requireHighRiskPayload(payload.getConfirmed(), payload.getOperatorId(), currentUserId, payload.getReason(), payload.getAuditEvidence(), "保存待办字段角色覆盖");
        return Result.success(todoFieldConfigService.saveRoleOverride(roleCode, payload));
    }

    @PostMapping("/reset-defaults")
    public Result<List<TodoFieldConfigDTO>> resetDefaults(
            @RequestBody(required = false) TodoFieldOperationDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_RESET);
        TodoFieldOperationDTO payload = dto == null ? new TodoFieldOperationDTO() : dto;
        requireHighRiskPayload(payload.getConfirmed(), payload.getOperatorId(), currentUserId, payload.getReason(), payload.getAuditEvidence(), "恢复待办字段默认配置");
        return Result.success(todoFieldConfigService.resetDefaults(payload));
    }

    @GetMapping("/preview")
    public Result<TodoFieldPreviewDTO> preview(
            @RequestParam(required = false) String roleCode,
            HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_LIST);
        return Result.success(todoFieldConfigService.preview(roleCode));
    }

    private void requireHighRiskPayload(Boolean confirmed, Long operatorId, Long currentUserId, String reason, String auditEvidence, String actionName) {
        if (!Boolean.TRUE.equals(confirmed)) {
            throw new BusinessException(actionName + "需要二次确认");
        }
        if (operatorId == null || operatorId <= 0) {
            throw new BusinessException(actionName + "需要操作人");
        }
        if (!operatorId.equals(currentUserId)) {
            throw new BusinessException(actionName + "操作人必须与当前登录用户一致");
        }
        if ((reason == null || reason.isBlank()) && (auditEvidence == null || auditEvidence.isBlank())) {
            throw new BusinessException(actionName + "需要审计原因或审计证据");
        }
    }

    private Long requireAnyPermission(HttpServletRequest request, String... permissions) {
        Long userId = requireCurrentUserId(request);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("缺少待办字段配置权限");
        }
        if (hasAnyPermission(authentication, permissions)) {
            return userId;
        }
        throw new AccessDeniedException("缺少待办字段配置权限");
    }

    private boolean hasAnyPermission(Authentication authentication, String... permissions) {
        if (!authentication.isAuthenticated()) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority -> ROLE_SUPER_ADMIN.equals(authority) || List.of(permissions).contains(authority));
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AccessDeniedException("缺少待办字段配置权限");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new AccessDeniedException("缺少待办字段配置权限");
        }
        return userId;
    }
}
