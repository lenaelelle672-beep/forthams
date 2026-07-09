package com.ams.controller;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.ams.dto.FormStorageAttachmentDTO;
import com.ams.dto.FormStorageExportDTO;
import com.ams.dto.FormStorageOperationDTO;
import com.ams.dto.FormStorageQueryDTO;
import com.ams.dto.FormStorageRecordDTO;
import com.ams.dto.FormStorageSaveDTO;
import com.ams.service.FormStorageService;
import com.ams.utils.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/form-storage")
@RequiredArgsConstructor
public class FormStorageController {

    private static final String PERMISSION_VIEW = "workflow:form-storage:view";
    private static final String PERMISSION_CREATE = "workflow:form-storage:create";
    private static final String PERMISSION_UPDATE = "workflow:form-storage:update";
    private static final String PERMISSION_ARCHIVE = "workflow:form-storage:archive";
    private static final String PERMISSION_DELETE = "workflow:form-storage:delete";
    private static final String PERMISSION_EXPORT = "workflow:form-storage:export";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final FormStorageService formStorageService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public Result<List<FormStorageRecordDTO>> list(@ModelAttribute FormStorageQueryDTO query, HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_VIEW);
        return Result.success(formStorageService.listRecords(query));
    }

    @GetMapping("/{instanceId}")
    public Result<FormStorageRecordDTO> get(@PathVariable Long instanceId, HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_VIEW);
        return Result.success(formStorageService.getRecord(instanceId));
    }

    @PostMapping
    public Result<FormStorageRecordDTO> create(@RequestBody(required = false) FormStorageSaveDTO dto, HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_CREATE);
        FormStorageSaveDTO payload = dto == null ? new FormStorageSaveDTO() : dto;
        payload.setOperatorId(currentUserId);
        return Result.success(formStorageService.createRecord(payload));
    }

    @PutMapping("/{instanceId}")
    public Result<FormStorageRecordDTO> update(
            @PathVariable Long instanceId,
            @RequestBody(required = false) FormStorageSaveDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_UPDATE);
        FormStorageSaveDTO payload = dto == null ? new FormStorageSaveDTO() : dto;
        payload.setOperatorId(currentUserId);
        return Result.success(formStorageService.updateRecord(instanceId, payload));
    }

    @PostMapping("/{instanceId}/archive")
    public Result<FormStorageRecordDTO> archive(
            @PathVariable Long instanceId,
            @RequestBody(required = false) FormStorageOperationDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_ARCHIVE);
        FormStorageOperationDTO operation = requireHighRiskPayload(dto, currentUserId, "归档");
        return Result.success(formStorageService.archiveRecord(instanceId, operation));
    }

    @DeleteMapping("/{instanceId}")
    public Result<FormStorageRecordDTO> markDeleted(
            @PathVariable Long instanceId,
            @RequestBody(required = false) FormStorageOperationDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_DELETE);
        FormStorageOperationDTO operation = requireHighRiskPayload(dto, currentUserId, "删除留痕");
        return Result.success(formStorageService.markDeleted(instanceId, operation));
    }

    @GetMapping("/{instanceId}/attachments")
    public Result<List<FormStorageAttachmentDTO>> listAttachments(
            @PathVariable Long instanceId,
            HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_VIEW);
        return Result.success(formStorageService.listAttachments(instanceId));
    }

    @PostMapping("/{instanceId}/attachments")
    public Result<FormStorageAttachmentDTO> registerAttachment(
            @PathVariable Long instanceId,
            @RequestBody(required = false) FormStorageAttachmentDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_UPDATE);
        FormStorageAttachmentDTO payload = dto == null ? new FormStorageAttachmentDTO() : dto;
        payload.setOperatorId(currentUserId);
        return Result.success(formStorageService.registerAttachment(instanceId, payload));
    }

    @DeleteMapping("/{instanceId}/attachments/{attachmentId}")
    public Result<FormStorageAttachmentDTO> removeAttachment(
            @PathVariable Long instanceId,
            @PathVariable Long attachmentId,
            @RequestBody(required = false) FormStorageOperationDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_DELETE);
        FormStorageOperationDTO operation = requireHighRiskPayload(dto, currentUserId, "附件引用删除");
        return Result.success(formStorageService.removeAttachment(instanceId, attachmentId, operation));
    }

    @PostMapping("/export")
    public Result<FormStorageExportDTO> exportMasked(
            @RequestBody(required = false) FormStorageOperationDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_EXPORT);
        FormStorageOperationDTO operation = requireHighRiskPayload(dto, currentUserId, "导出");
        return Result.success(formStorageService.exportMasked(operation));
    }

    private FormStorageOperationDTO requireHighRiskPayload(FormStorageOperationDTO dto, Long currentUserId, String actionName) {
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
        if ((dto.getReason() == null || dto.getReason().isBlank()) && (dto.getAuditEvidence() == null || dto.getAuditEvidence().isBlank())) {
            throw new BusinessException(actionName + "操作需要审计原因或审计证据");
        }
        return dto;
    }

    private Long requireAnyPermission(HttpServletRequest request, String... permissions) {
        Long userId = requireCurrentUserId(request);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("缺少表单存储权限");
        }
        if (hasAnyPermission(authentication, permissions)) {
            return userId;
        }
        throw new AccessDeniedException("缺少表单存储权限");
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
            throw new AccessDeniedException("缺少表单存储权限");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new AccessDeniedException("缺少表单存储权限");
        }
        return userId;
    }
}
