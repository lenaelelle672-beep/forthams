package com.ams.controller;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.ams.dto.FormDefinitionDTO;
import com.ams.dto.FormDefinitionOperationDTO;
import com.ams.dto.FormDefinitionPreviewDTO;
import com.ams.dto.FormDefinitionSaveDTO;
import com.ams.dto.FormDefinitionSchemaValidationResultDTO;
import com.ams.dto.FormDefinitionVersionDTO;
import com.ams.service.FormDefinitionService;
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
import java.util.Map;

@RestController
@RequestMapping("/form-definitions")
@RequiredArgsConstructor
public class FormDefinitionController {

    private static final String PERMISSION_LIST = "workflow:form:list";
    private static final String PERMISSION_VIEW = "workflow:form:view";
    private static final String PERMISSION_UPDATE = "workflow:form:update";
    private static final String PERMISSION_PUBLISH = "workflow:form:publish";
    private static final String PERMISSION_DISABLE = "workflow:form:disable";
    private static final String PERMISSION_ROLLBACK = "workflow:form:rollback";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final FormDefinitionService formDefinitionService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public Result<List<FormDefinitionDTO>> list(HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_LIST, PERMISSION_VIEW);
        return Result.success(formDefinitionService.listDefinitions());
    }

    @GetMapping("/{formKey}")
    public Result<FormDefinitionDTO> get(@PathVariable String formKey, HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_VIEW);
        return Result.success(formDefinitionService.getDefinition(formKey));
    }

    @PutMapping("/{formKey}/draft")
    public Result<FormDefinitionDTO> saveDraft(
            @PathVariable String formKey,
            @RequestBody(required = false) FormDefinitionSaveDTO dto,
            HttpServletRequest request) {
        FormDefinitionSaveDTO payload = dto == null ? new FormDefinitionSaveDTO() : dto;
        payload.setOperatorId(requireAnyPermission(request, PERMISSION_UPDATE));
        return Result.success(formDefinitionService.saveDraft(formKey, payload));
    }

    @PostMapping("/{formKey}/schema/validate")
    public Result<FormDefinitionSchemaValidationResultDTO> validateSchema(
            @PathVariable String formKey,
            @RequestBody(required = false) FormDefinitionSaveDTO dto,
            HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_UPDATE);
        return Result.success(formDefinitionService.validateSchema(dto));
    }

    @PostMapping("/{formKey}/publish")
    public Result<FormDefinitionDTO> publish(
            @PathVariable String formKey,
            @RequestBody(required = false) FormDefinitionOperationDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_PUBLISH);
        FormDefinitionOperationDTO operation = requireHighRiskPayload(dto, currentUserId, "发布");
        return Result.success(formDefinitionService.publish(formKey, operation));
    }

    @PostMapping("/{formKey}/disable")
    public Result<FormDefinitionDTO> disable(
            @PathVariable String formKey,
            @RequestBody(required = false) FormDefinitionOperationDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_DISABLE);
        FormDefinitionOperationDTO operation = requireHighRiskPayload(dto, currentUserId, "停用");
        return Result.success(formDefinitionService.disable(formKey, operation));
    }

    @GetMapping("/{formKey}/versions")
    public Result<List<FormDefinitionVersionDTO>> listVersions(
            @PathVariable String formKey,
            HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_VIEW);
        return Result.success(formDefinitionService.listVersions(formKey));
    }

    @GetMapping("/{formKey}/versions/{version}")
    public Result<FormDefinitionVersionDTO> getVersion(
            @PathVariable String formKey,
            @PathVariable Integer version,
            HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_VIEW);
        return Result.success(formDefinitionService.getVersion(formKey, version));
    }

    @PostMapping("/{formKey}/versions/{version}/rollback")
    public Result<FormDefinitionDTO> rollback(
            @PathVariable String formKey,
            @PathVariable Integer version,
            @RequestBody(required = false) FormDefinitionOperationDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_ROLLBACK);
        FormDefinitionOperationDTO operation = requireHighRiskPayload(dto, currentUserId, "回滚");
        return Result.success(formDefinitionService.rollback(formKey, version, operation));
    }

    @GetMapping("/{formKey}/preview")
    public Result<FormDefinitionPreviewDTO> preview(@PathVariable String formKey, HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_VIEW);
        return Result.success(formDefinitionService.preview(formKey));
    }

    @GetMapping("/{formKey}/references")
    public Result<Map<String, Object>> references(@PathVariable String formKey, HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_VIEW);
        return Result.success(formDefinitionService.references(formKey));
    }

    private FormDefinitionOperationDTO requireHighRiskPayload(FormDefinitionOperationDTO dto, Long currentUserId, String actionName) {
        if (dto == null) {
            throw new BusinessException(actionName + "操作需要二次确认");
        }
        if (!Boolean.TRUE.equals(dto.getConfirmed())) {
            throw new BusinessException(actionName + "操作需要二次确认");
        }
        if (dto.getOperatorId() == null || dto.getOperatorId() <= 0) {
            throw new BusinessException(actionName + "操作需要操作人");
        }
        if (!dto.getOperatorId().equals(currentUserId)) {
            throw new BusinessException(actionName + "操作人必须与当前登录用户一致");
        }
        if (dto.getReason() == null || dto.getReason().isBlank()) {
            throw new BusinessException(actionName + "操作需要审计原因");
        }
        if (dto.getImpactScope() == null || dto.getImpactScope().isBlank()) {
            throw new BusinessException(actionName + "操作需要影响范围");
        }
        if (dto.getRollbackPlan() == null || dto.getRollbackPlan().isBlank()) {
            throw new BusinessException(actionName + "操作需要回滚预案");
        }
        return dto;
    }

    private Long requireAnyPermission(HttpServletRequest request, String... permissions) {
        Long userId = requireCurrentUserId(request);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("缺少表单配置权限");
        }
        if (hasAnyPermission(authentication, permissions)) {
            return userId;
        }
        throw new AccessDeniedException("缺少表单配置权限");
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
            throw new AccessDeniedException("缺少表单配置权限");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new AccessDeniedException("缺少表单配置权限");
        }
        return userId;
    }
}
