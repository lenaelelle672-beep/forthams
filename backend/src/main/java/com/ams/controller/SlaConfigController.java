package com.ams.controller;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.ams.dto.SlaConfigDTO;
import com.ams.dto.SlaConfigOperationDTO;
import com.ams.dto.SlaConfigSaveDTO;
import com.ams.dto.SlaConfigSimulationDTO;
import com.ams.dto.SlaConfigSimulationResultDTO;
import com.ams.dto.SlaRuntimeSummaryDTO;
import com.ams.dto.SlaTimeoutExportDTO;
import com.ams.dto.SlaTimeoutRecordDTO;
import com.ams.service.SlaConfigService;
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
@RequestMapping("/sla-config")
@RequiredArgsConstructor
public class SlaConfigController {

    private static final String PERMISSION_LIST = "workflow:sla:list";
    private static final String PERMISSION_UPDATE = "workflow:sla:update";
    private static final String PERMISSION_ENABLE = "workflow:sla:enable";
    private static final String PERMISSION_DISABLE = "workflow:sla:disable";
    private static final String PERMISSION_TEST = "workflow:sla:test";
    private static final String PERMISSION_EXPORT = "workflow:sla:export";
    private static final String PERMISSION_RUNTIME_QUERY = "system:runtime:query";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final SlaConfigService slaConfigService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public Result<List<SlaConfigDTO>> list(
            @RequestParam(required = false) String processKey,
            @RequestParam(required = false) String businessType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_LIST);
        return Result.success(slaConfigService.listConfigs(processKey, businessType, status, priority));
    }

    @GetMapping("/{configId}")
    public Result<SlaConfigDTO> detail(@PathVariable Long configId, HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_LIST);
        return Result.success(slaConfigService.getConfig(configId));
    }

    @PutMapping("/{configId}")
    public Result<SlaConfigDTO> update(
            @PathVariable Long configId,
            @RequestBody(required = false) SlaConfigSaveDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_UPDATE);
        SlaConfigSaveDTO payload = dto == null ? new SlaConfigSaveDTO() : dto;
        if (payload.getOperatorId() == null) {
            payload.setOperatorId(currentUserId);
        }
        if (!payload.getOperatorId().equals(currentUserId)) {
            throw new BusinessException("SLA策略更新操作人必须与当前登录用户一致");
        }
        if ((payload.getReason() == null || payload.getReason().isBlank()) && (payload.getAuditEvidence() == null || payload.getAuditEvidence().isBlank())) {
            payload.setAuditEvidence("SLA_CONFIG_LEGACY_UPDATE");
        }
        return Result.success(slaConfigService.updateConfig(configId, payload));
    }

    @PostMapping("/{configId}/enable")
    public Result<SlaConfigDTO> enable(
            @PathVariable Long configId,
            @RequestBody(required = false) SlaConfigOperationDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_ENABLE);
        SlaConfigOperationDTO operation = requireHighRiskPayload(dto, currentUserId, "启用SLA策略");
        return Result.success(slaConfigService.enableConfig(configId, operation));
    }

    @PostMapping("/{configId}/disable")
    public Result<SlaConfigDTO> disable(
            @PathVariable Long configId,
            @RequestBody(required = false) SlaConfigOperationDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_DISABLE);
        SlaConfigOperationDTO operation = requireHighRiskPayload(dto, currentUserId, "停用SLA策略");
        return Result.success(slaConfigService.disableConfig(configId, operation));
    }

    @PostMapping("/simulate")
    public Result<SlaConfigSimulationResultDTO> simulate(
            @RequestBody(required = false) SlaConfigSimulationDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_TEST);
        SlaConfigSimulationDTO payload = dto == null ? new SlaConfigSimulationDTO() : dto;
        requireAuditPayload(payload.getOperatorId(), currentUserId, payload.getReason(), payload.getAuditEvidence(), "SLA策略模拟");
        if (!Boolean.TRUE.equals(payload.getConfirmed())) {
            throw new BusinessException("SLA策略模拟需要二次确认");
        }
        return Result.success(slaConfigService.simulate(payload));
    }

    @GetMapping("/runtime-summary")
    public Result<SlaRuntimeSummaryDTO> runtimeSummary(HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_LIST, PERMISSION_RUNTIME_QUERY);
        return Result.success(slaConfigService.runtimeSummary());
    }

    @GetMapping("/timeout-records")
    public Result<List<SlaTimeoutRecordDTO>> timeoutRecords(
            @RequestParam(required = false) String processKey,
            @RequestParam(required = false) String nodeKey,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String riskLevel,
            HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_LIST, PERMISSION_RUNTIME_QUERY);
        return Result.success(slaConfigService.listTimeoutRecords(processKey, nodeKey, status, riskLevel));
    }

    @PostMapping("/export")
    public Result<SlaTimeoutExportDTO> export(
            @RequestBody(required = false) SlaTimeoutExportDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_EXPORT);
        SlaTimeoutExportDTO payload = dto == null ? new SlaTimeoutExportDTO() : dto;
        requireHighRiskPayload(payload.getConfirmed(), payload.getOperatorId(), currentUserId, payload.getReason(), payload.getAuditEvidence(), "SLA脱敏导出");
        return Result.success(slaConfigService.exportTimeoutRecords(payload));
    }

    private SlaConfigOperationDTO requireHighRiskPayload(SlaConfigOperationDTO dto, Long currentUserId, String actionName) {
        if (dto == null) {
            throw new BusinessException(actionName + "需要二次确认");
        }
        requireHighRiskPayload(dto.getConfirmed(), dto.getOperatorId(), currentUserId, dto.getReason(), dto.getAuditEvidence(), actionName);
        return dto;
    }

    private void requireHighRiskPayload(Boolean confirmed, Long operatorId, Long currentUserId, String reason, String auditEvidence, String actionName) {
        if (!Boolean.TRUE.equals(confirmed)) {
            throw new BusinessException(actionName + "需要二次确认");
        }
        requireAuditPayload(operatorId, currentUserId, reason, auditEvidence, actionName);
    }

    private void requireAuditPayload(Long operatorId, Long currentUserId, String reason, String auditEvidence, String actionName) {
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
            throw new AccessDeniedException("缺少SLA配置权限");
        }
        if (hasAnyPermission(authentication, permissions)) {
            return userId;
        }
        throw new AccessDeniedException("缺少SLA配置权限");
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
            throw new AccessDeniedException("缺少SLA配置权限");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new AccessDeniedException("缺少SLA配置权限");
        }
        return userId;
    }
}
