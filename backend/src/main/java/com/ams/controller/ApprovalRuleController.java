package com.ams.controller;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.ams.dto.ApprovalRuleConflictDTO;
import com.ams.dto.ApprovalRuleDTO;
import com.ams.dto.ApprovalRuleOperationDTO;
import com.ams.dto.ApprovalRuleSaveDTO;
import com.ams.dto.ApprovalRuleSimulationDTO;
import com.ams.dto.ApprovalRuleSimulationResultDTO;
import com.ams.service.ApprovalRuleService;
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
@RequestMapping("/approval-rules")
@RequiredArgsConstructor
public class ApprovalRuleController {

    private static final String PERMISSION_LIST = "workflow:approval-rule:list";
    private static final String PERMISSION_CREATE = "workflow:approval-rule:create";
    private static final String PERMISSION_UPDATE = "workflow:approval-rule:update";
    private static final String PERMISSION_ENABLE = "workflow:approval-rule:enable";
    private static final String PERMISSION_DISABLE = "workflow:approval-rule:disable";
    private static final String PERMISSION_TEST = "workflow:approval-rule:test";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final ApprovalRuleService approvalRuleService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public Result<List<ApprovalRuleDTO>> list(
            @RequestParam(required = false) String processKey,
            @RequestParam(required = false) String nodeKey,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_LIST);
        return Result.success(approvalRuleService.listRules(processKey, nodeKey, status, keyword));
    }

    @GetMapping("/{ruleId}")
    public Result<ApprovalRuleDTO> get(@PathVariable Long ruleId, HttpServletRequest request) {
        requireAnyPermission(request, PERMISSION_LIST);
        return Result.success(approvalRuleService.getRule(ruleId));
    }

    @PostMapping
    public Result<ApprovalRuleDTO> create(@RequestBody(required = false) ApprovalRuleSaveDTO dto, HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_CREATE);
        ApprovalRuleSaveDTO payload = dto == null ? new ApprovalRuleSaveDTO() : dto;
        requireAuditPayload(payload.getOperatorId(), currentUserId, payload.getReason(), payload.getAuditEvidence(), "创建审批规则");
        return Result.success(approvalRuleService.createRule(payload));
    }

    @PutMapping("/{ruleId}")
    public Result<ApprovalRuleDTO> update(
            @PathVariable Long ruleId,
            @RequestBody(required = false) ApprovalRuleSaveDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_UPDATE);
        ApprovalRuleSaveDTO payload = dto == null ? new ApprovalRuleSaveDTO() : dto;
        requireAuditPayload(payload.getOperatorId(), currentUserId, payload.getReason(), payload.getAuditEvidence(), "更新审批规则");
        return Result.success(approvalRuleService.updateRule(ruleId, payload));
    }

    @PostMapping("/{ruleId}/enable")
    public Result<ApprovalRuleDTO> enable(
            @PathVariable Long ruleId,
            @RequestBody(required = false) ApprovalRuleOperationDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_ENABLE);
        ApprovalRuleOperationDTO operation = requireHighRiskPayload(dto, currentUserId, "启用审批规则");
        return Result.success(approvalRuleService.enableRule(ruleId, operation));
    }

    @PostMapping("/{ruleId}/disable")
    public Result<ApprovalRuleDTO> disable(
            @PathVariable Long ruleId,
            @RequestBody(required = false) ApprovalRuleOperationDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_DISABLE);
        ApprovalRuleOperationDTO operation = requireHighRiskPayload(dto, currentUserId, "停用审批规则");
        return Result.success(approvalRuleService.disableRule(ruleId, operation));
    }

    @PostMapping("/simulate")
    public Result<ApprovalRuleSimulationResultDTO> simulate(
            @RequestBody(required = false) ApprovalRuleSimulationDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_TEST);
        ApprovalRuleSimulationDTO payload = dto == null ? new ApprovalRuleSimulationDTO() : dto;
        requireAuditPayload(payload.getOperatorId(), currentUserId, payload.getReason(), payload.getAuditEvidence(), "模拟审批规则");
        return Result.success(approvalRuleService.simulate(payload));
    }

    @PostMapping("/conflicts")
    public Result<List<ApprovalRuleConflictDTO>> conflicts(
            @RequestBody(required = false) ApprovalRuleSimulationDTO dto,
            HttpServletRequest request) {
        Long currentUserId = requireAnyPermission(request, PERMISSION_TEST);
        ApprovalRuleSimulationDTO payload = dto == null ? new ApprovalRuleSimulationDTO() : dto;
        requireAuditPayload(payload.getOperatorId(), currentUserId, payload.getReason(), payload.getAuditEvidence(), "检测审批规则冲突");
        return Result.success(approvalRuleService.detectConflicts(payload));
    }

    private ApprovalRuleOperationDTO requireHighRiskPayload(ApprovalRuleOperationDTO dto, Long currentUserId, String actionName) {
        if (dto == null) {
            throw new BusinessException(actionName + "需要二次确认");
        }
        if (!Boolean.TRUE.equals(dto.getConfirmed())) {
            throw new BusinessException(actionName + "需要二次确认");
        }
        requireAuditPayload(dto.getOperatorId(), currentUserId, dto.getReason(), dto.getAuditEvidence(), actionName);
        return dto;
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
            throw new AccessDeniedException("缺少审批规则权限");
        }
        if (hasAnyPermission(authentication, permissions)) {
            return userId;
        }
        throw new AccessDeniedException("缺少审批规则权限");
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
            throw new AccessDeniedException("缺少审批规则权限");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new AccessDeniedException("缺少审批规则权限");
        }
        return userId;
    }
}
