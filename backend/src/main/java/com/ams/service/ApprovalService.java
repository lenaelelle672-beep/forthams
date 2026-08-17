package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.ApprovalCreateDTO;
import com.ams.dto.ApprovalRecoveryDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.ApprovalRecord;
import com.ams.entity.User;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.ApprovalRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.StringJoiner;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class ApprovalService {

    private static final String RETIREMENT_PROCESS_TYPE = "RETIREMENT";
    private static final String WORK_ORDER_PROCESS_TYPE = "WORK_ORDER";
    private static final String COMPENSATION_PROCESS_TYPE = "COMPENSATION";
    private static final String DISPOSAL_PROCESS_TYPE = "DISPOSAL";
    private static final String RETIREMENT_QUERY_PERMISSION = "retirement:query";
    private static final String RETIREMENT_APPROVE_PERMISSION = "retirement:approve";
    private static final String WORK_ORDER_QUERY_PERMISSION = "workorder:query";
    private static final String WORK_ORDER_APPROVE_PERMISSION = "workorder:approve";
    private static final String COMPENSATION_QUERY_PERMISSION = "compensation:query";
    private static final String COMPENSATION_APPROVE_PERMISSION = "compensation:approve";
    private static final String DISPOSAL_QUERY_PERMISSION = "disposal:query";
    private static final String DISPOSAL_APPROVE_PERMISSION = "disposal:approve";
    private static final String APPROVAL_QUERY_PERMISSION = "approval:query";
    private static final String APPROVAL_CREATE_PERMISSION = "approval:create";
    private static final String APPROVAL_APPROVE_PERMISSION = "approval:approve";
    private static final String CANCELLED_REQUIRES_RESUBMISSION = "CANCELLED_REQUIRES_RESUBMISSION";
    private static final String MISSING_TRUSTED_CURRENT_ASSIGNMENT = "MISSING_TRUSTED_CURRENT_ASSIGNMENT";
    private static final Set<String> SUPPORTED_PROCESS_TYPES = Set.of(
            RETIREMENT_PROCESS_TYPE, WORK_ORDER_PROCESS_TYPE, COMPENSATION_PROCESS_TYPE, DISPOSAL_PROCESS_TYPE);
    private static final Set<String> SUPPORTED_PROCESS_STATUSES = Set.of(
            "PENDING", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED", CANCELLED_REQUIRES_RESUBMISSION);
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_PENDING_RESULTS = 100;

    private final ApprovalProcessMapper approvalProcessMapper;
    private final ApprovalRecordMapper approvalRecordMapper;
    private final RetirementApplicationService retirementApplicationService;
    private final WorkOrderService workOrderService;
    private final CompensationService compensationService;
    private final DisposalService disposalService;
    private final AssetDataPermissionEvaluator assetDataPermissionEvaluator;
    private final TenantAuthorityService tenantAuthorityService;
    private final ApprovalAssignmentService approvalAssignmentService;

    public Page<ApprovalProcess> queryProcesses(Integer page, Integer pageSize, String status, String processType) {
        String tenantId = TenantContext.requireTenantId();
        requirePermission(APPROVAL_QUERY_PERMISSION);
        String normalizedProcessType = normalizeOptionalProcessType(processType);
        Set<String> permittedProcessTypes = resolvePermittedQueryProcessTypes(normalizedProcessType);
        Page<ApprovalProcess> pageParam = new Page<>(normalizePage(page), normalizePageSize(pageSize));
        QueryWrapper<ApprovalProcess> wrapper = new QueryWrapper<>();
        wrapper.eq("tenant_id", tenantId);
        applySupportedProcessTypeScope(wrapper, permittedProcessTypes);

        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", normalizeStatus(status));
        }
        if (normalizedProcessType != null) {
            wrapper.apply("UPPER(TRIM(process_type)) = {0}", normalizedProcessType);
        }
        wrapper.orderByDesc("create_time");

        return approvalProcessMapper.selectPage(pageParam, wrapper);
    }

    public Map<String, Object> getProcessById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        requirePermission(APPROVAL_QUERY_PERMISSION);
        ApprovalProcess process = approvalProcessMapper.selectOne(new QueryWrapper<ApprovalProcess>()
                .eq("id", id)
                .eq("tenant_id", tenantId)
                .last("limit 1"));
        if (process == null) {
            throw new BusinessException("审批流程不存在");
        }
        requireProcessQueryPermission(process);
        requireProcessAssetAccess(process);

        List<ApprovalRecord> records = approvalRecordMapper.selectList(
            new QueryWrapper<ApprovalRecord>()
                .eq("process_id", id)
                .eq("tenant_id", tenantId)
                .orderByAsc("step_no")
                .orderByAsc("create_time")
                .last("limit " + MAX_PENDING_RESULTS)
        );

        Map<String, Object> result = new HashMap<>();
        result.put("process", process);
        result.put("records", records);
        return result;
    }

    public ApprovalRecoveryDTO getRecoveryGuidance(Long id) {
        String tenantId = TenantContext.requireTenantId();
        requirePermission(APPROVAL_QUERY_PERMISSION);
        ApprovalProcess process = approvalProcessMapper.selectOne(new QueryWrapper<ApprovalProcess>()
                .eq("id", id)
                .eq("tenant_id", tenantId)
                .last("limit 1"));
        if (process == null) {
            throw new BusinessException("审批流程不存在");
        }
        requireProcessQueryPermission(process);
        requireProcessAssetAccess(process);
        if (!CANCELLED_REQUIRES_RESUBMISSION.equals(process.getStatus())
                || !MISSING_TRUSTED_CURRENT_ASSIGNMENT.equals(process.getCancellationReason())
                || process.getCancelledAt() == null) {
            throw new BusinessException("该审批流程不需要重提指引");
        }

        String processType = normalizeProcessType(process.getProcessType());
        ApprovalRecoveryDTO recovery = new ApprovalRecoveryDTO();
        recovery.setProcessId(process.getId());
        recovery.setProcessType(processType);
        recovery.setBusinessId(process.getBusinessId());
        recovery.setStatus(process.getStatus());
        recovery.setCancellationReason(process.getCancellationReason());
        recovery.setCancelledAt(process.getCancelledAt());
        switch (processType) {
            case RETIREMENT_PROCESS_TYPE -> {
                recovery.setResubmissionAction("RESUBMIT_EXISTING");
                recovery.setResubmissionInstruction("请重新提交原退役申请；系统会先恢复资产的提交前状态，再生成新的处理人快照。");
            }
            case WORK_ORDER_PROCESS_TYPE -> {
                recovery.setResubmissionAction("RESUBMIT_EXISTING");
                recovery.setResubmissionInstruction("请更新原工单后重新提交；系统将在提交时生成新的处理人快照。");
            }
            case COMPENSATION_PROCESS_TYPE -> {
                recovery.setResubmissionAction("CREATE_NEW");
                recovery.setResubmissionInstruction("请基于原申请信息新建赔偿申请；新申请将在提交时生成新的处理人快照。");
            }
            case DISPOSAL_PROCESS_TYPE -> {
                recovery.setResubmissionAction("CREATE_NEW");
                recovery.setResubmissionInstruction("请基于原申请信息新建处置申请；新申请将在提交时生成新的处理人快照。");
            }
            default -> throw new AccessDeniedException("不支持的审批流程类型");
        }
        return recovery;
    }

    @Transactional(rollbackFor = Exception.class)
    public ApprovalProcess createProcess(ApprovalCreateDTO dto) {
        requirePermission(APPROVAL_CREATE_PERMISSION);
        String processType = normalizeProcessType(dto == null ? null : dto.getProcessType());
        if (RETIREMENT_PROCESS_TYPE.equals(processType)) {
            throw new AccessDeniedException("退役审批流程必须通过受控退役申请创建");
        }
        throw new AccessDeniedException("工单审批流程必须通过受控工单提交创建");
    }

    @Transactional(rollbackFor = Exception.class)
    public ApprovalProcess approve(Long processId, Long approverId, String result, String opinion) {
        String tenantId = TenantContext.requireTenantId();
        requirePermission(APPROVAL_APPROVE_PERMISSION);
        User currentUser = tenantAuthorityService.requireCurrentTenantMember();
        if (approverId == null || currentUser.getId() == null || !approverId.equals(currentUser.getId())) {
            throw new AccessDeniedException("审批人必须是当前租户已认证成员");
        }
        ApprovalProcess process = approvalProcessMapper.selectOne(new QueryWrapper<ApprovalProcess>()
                .eq("id", processId)
                .eq("tenant_id", tenantId)
                .last("limit 1"));
        if (process == null) {
            throw new BusinessException("审批流程不存在");
        }
        requireProcessApprovePermission(process);
        requireProcessAssetAccess(process);
        if (!"PENDING".equals(BeanUtil.getProperty(process, "status"))) {
            throw new BusinessException("当前流程不可审批");
        }

        // 自审批检查：审批人不能审批自己发起的请求（职责分离）
        Long applicantId = process.getApplicantId();
        if (applicantId == null) {
            throw new AccessDeniedException("审批流程缺少申请人，拒绝处理");
        }
        if (approverId.equals(applicantId)) {
            throw new BusinessException("不能审批自己发起的流程");
        }

        Integer currentStep = parseInteger(BeanUtil.getProperty(process, "currentStep"), 1);
        int finalStep = resolveFinalStep(process);

        // BUG 2.3 修复：先验证 result 再 insert，避免坏顺序依赖事务回滚
        boolean isApproved = "APPROVED".equals(result);
        boolean isRejected = "REJECTED".equals(result);
        if (!isApproved && !isRejected) {
            throw new BusinessException("审批结果无效");
        }

        // 先以 process/step/assignee/PENDING 原子条件保留当前节点。仅有动作权限不是
        // 节点分配；没有提交时冻结的节点记录的历史流程也必须 fail-closed。
        approvalAssignmentService.reserveCurrentAssignment(process, approverId);

        if (isRejected) {
            BeanUtil.setProperty(process, "status", "REJECTED");
        } else if (isApproved) {
            if (currentStep >= finalStep) {
                BeanUtil.setProperty(process, "status", "APPROVED");
            } else {
                BeanUtil.setProperty(process, "currentStep", currentStep + 1);
            }
        }

        int version = versionOf(process.getVersion());
        process.setVersion(version + 1);
        int updated = approvalProcessMapper.update(process, new LambdaUpdateWrapper<ApprovalProcess>()
                .eq(ApprovalProcess::getId, processId)
                .eq(ApprovalProcess::getTenantId, tenantId)
                .eq(ApprovalProcess::getStatus, "PENDING")
                .eq(ApprovalProcess::getCurrentStep, currentStep)
                .eq(ApprovalProcess::getVersion, version));
        if (updated != 1) {
            throw new BusinessException("审批流程已变更，请刷新后重试");
        }
        if (isRejected) {
            approvalAssignmentService.freezePendingAssignments(processId);
        }

        ApprovalRecord record = new ApprovalRecord();
        BeanUtil.setProperty(record, "processId", processId);
        BeanUtil.setProperty(record, "tenantId", tenantId);
        BeanUtil.setProperty(record, "stepNo", currentStep);
        BeanUtil.setProperty(record, "approverId", approverId);
        BeanUtil.setProperty(record, "approveResult", result);
        BeanUtil.setProperty(record, "approveOpinion", opinion);
        BeanUtil.setProperty(record, "approveTime", LocalDateTime.now());
        if (approvalRecordMapper.insert(record) != 1) {
            throw new BusinessException("审批记录写入失败");
        }
        handleBusinessOutcome(process, approverId, result, opinion);
        return process;
    }

    public List<ApprovalProcess> getMyPendingApprovals(Long approverId) {
        String tenantId = TenantContext.requireTenantId();
        requirePermission(APPROVAL_QUERY_PERMISSION);
        User currentUser = tenantAuthorityService.requireCurrentTenantMember();
        if (approverId == null || currentUser.getId() == null || !approverId.equals(currentUser.getId())) {
            throw new AccessDeniedException("审批人必须是当前租户已认证成员");
        }
        Set<String> permittedProcessTypes = resolvePermittedPendingProcessTypes();
        QueryWrapper<ApprovalProcess> wrapper = new QueryWrapper<ApprovalProcess>()
                .eq("tenant_id", tenantId)
                .eq("status", "PENDING");
        applySupportedProcessTypeScope(wrapper, permittedProcessTypes);
        approvalAssignmentService.applyCurrentPendingAssignmentScope(wrapper, approverId);
        wrapper.orderByDesc("create_time");
        wrapper.last("limit " + MAX_PENDING_RESULTS);
        return approvalProcessMapper.selectList(wrapper);
    }

    public Long getPendingCount(Long approverId) {
        String tenantId = TenantContext.requireTenantId();
        requirePermission(APPROVAL_QUERY_PERMISSION);
        User currentUser = tenantAuthorityService.requireCurrentTenantMember();
        if (approverId == null || currentUser.getId() == null || !approverId.equals(currentUser.getId())) {
            throw new AccessDeniedException("审批人必须是当前租户已认证成员");
        }
        Set<String> permittedProcessTypes = resolvePermittedPendingProcessTypes();
        QueryWrapper<ApprovalProcess> wrapper = new QueryWrapper<ApprovalProcess>()
                .eq("tenant_id", tenantId)
                .eq("status", "PENDING");
        applySupportedProcessTypeScope(wrapper, permittedProcessTypes);
        approvalAssignmentService.applyCurrentPendingAssignmentScope(wrapper, approverId);
        return approvalProcessMapper.selectCount(wrapper);
    }

    private Integer parseInteger(Object value, Integer defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Integer) {
            return (Integer) value;
        }
        String str = value.toString();
        if (str.isEmpty()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(str);
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
    }

    private int resolveFinalStep(ApprovalProcess process) {
        normalizeProcessType(process.getProcessType());
        return approvalAssignmentService.getFinalStep(process);
    }

    private void handleBusinessOutcome(ApprovalProcess process, Long approverId, String result, String opinion) {
        if (process.getBusinessId() == null) {
            return;
        }
        String processType = normalizeProcessType(process.getProcessType());
        if (RETIREMENT_PROCESS_TYPE.equals(processType)) {
            if ("REJECTED".equals(result)) {
                retirementApplicationService.applyApprovalOutcome(process.getBusinessId(), result, approverId, opinion);
            } else if ("APPROVED".equals(process.getStatus())) {
                retirementApplicationService.applyApprovalOutcome(process.getBusinessId(), result, approverId, opinion);
            } else if ("APPROVED".equals(result) && "PENDING".equals(process.getStatus())) {
                // Intermediate step advanced but process not yet terminal — mark the
                // retirement application as APPROVING so its status reflects progress.
                Integer advancedStep = parseInteger(BeanUtil.getProperty(process, "currentStep"), null);
                retirementApplicationService.updateReviewStatus(process.getBusinessId(), advancedStep);
            }
        } else if (WORK_ORDER_PROCESS_TYPE.equals(processType)) {
            if ("REJECTED".equals(result)) {
                workOrderService.applyApprovalOutcome(process.getBusinessId(), "REJECTED", opinion);
            } else if ("APPROVED".equals(process.getStatus())) {
                workOrderService.applyApprovalOutcome(process.getBusinessId(), "APPROVED", opinion);
            }
        } else if (COMPENSATION_PROCESS_TYPE.equals(processType)) {
            if ("REJECTED".equals(result) || "APPROVED".equals(process.getStatus())) {
                compensationService.applyApprovalOutcome(process.getBusinessId(), result, approverId, opinion);
            }
        } else if (DISPOSAL_PROCESS_TYPE.equals(processType)) {
            if ("REJECTED".equals(result) || "APPROVED".equals(process.getStatus())) {
                disposalService.applyApprovalOutcome(process.getBusinessId(), result, approverId, opinion);
            }
        } else {
            throw new AccessDeniedException("不支持的审批流程类型");
        }
    }

    private void requireProcessQueryPermission(ApprovalProcess process) {
        String processType = normalizeProcessType(process.getProcessType());
        if (RETIREMENT_PROCESS_TYPE.equals(processType)) {
            requirePermission(RETIREMENT_QUERY_PERMISSION);
            return;
        }
        if (WORK_ORDER_PROCESS_TYPE.equals(processType)) {
            requirePermission(WORK_ORDER_QUERY_PERMISSION);
            return;
        }
        if (COMPENSATION_PROCESS_TYPE.equals(processType)) {
            requirePermission(COMPENSATION_QUERY_PERMISSION);
            return;
        }
        if (DISPOSAL_PROCESS_TYPE.equals(processType)) {
            requirePermission(DISPOSAL_QUERY_PERMISSION);
            return;
        }
        throw new AccessDeniedException("不支持的审批流程类型");
    }

    private void requireProcessApprovePermission(ApprovalProcess process) {
        String processType = normalizeProcessType(process.getProcessType());
        if (RETIREMENT_PROCESS_TYPE.equals(processType)) {
            requirePermission(RETIREMENT_APPROVE_PERMISSION);
            return;
        }
        if (WORK_ORDER_PROCESS_TYPE.equals(processType)) {
            requirePermission(WORK_ORDER_APPROVE_PERMISSION);
            return;
        }
        if (COMPENSATION_PROCESS_TYPE.equals(processType)) {
            requirePermission(COMPENSATION_APPROVE_PERMISSION);
            return;
        }
        if (DISPOSAL_PROCESS_TYPE.equals(processType)) {
            requirePermission(DISPOSAL_APPROVE_PERMISSION);
            return;
        }
        throw new AccessDeniedException("不支持的审批流程类型");
    }

    private void requireProcessAssetAccess(ApprovalProcess process) {
        String processType = normalizeProcessType(process.getProcessType());
        if (process.getBusinessId() == null) {
            throw new AccessDeniedException("审批流程缺少关联业务记录");
        }
        if (RETIREMENT_PROCESS_TYPE.equals(processType)) {
            retirementApplicationService.getApplicationById(process.getBusinessId());
            return;
        }
        if (WORK_ORDER_PROCESS_TYPE.equals(processType)) {
            workOrderService.getWorkOrder(process.getBusinessId());
            return;
        }
        if (COMPENSATION_PROCESS_TYPE.equals(processType)) {
            compensationService.getById(process.getBusinessId());
            return;
        }
        if (DISPOSAL_PROCESS_TYPE.equals(processType)) {
            disposalService.getApplicationById(process.getBusinessId());
            return;
        }
        throw new AccessDeniedException("不支持的审批流程类型");
    }

    private Set<String> resolvePermittedQueryProcessTypes(String requestedProcessType) {
        if (requestedProcessType != null) {
            requireQueryPermissionForType(requestedProcessType);
            return Set.of(requestedProcessType);
        }

        Set<String> permittedProcessTypes = new LinkedHashSet<>();
        for (String processType : SUPPORTED_PROCESS_TYPES) {
            if (hasPermission(permissionForQuery(processType))) {
                permittedProcessTypes.add(processType);
            }
        }
        if (permittedProcessTypes.isEmpty()) {
            throw new AccessDeniedException("缺少已支持审批流程的业务查询权限");
        }
        return permittedProcessTypes;
    }

    private Set<String> resolvePermittedPendingProcessTypes() {
        Set<String> permittedProcessTypes = new LinkedHashSet<>();
        for (String processType : SUPPORTED_PROCESS_TYPES) {
            if (hasPermission(permissionForQuery(processType)) && hasPermission(permissionForApprove(processType))) {
                permittedProcessTypes.add(processType);
            }
        }
        if (permittedProcessTypes.isEmpty()) {
            throw new AccessDeniedException("缺少可处理审批流程的查询或审批权限");
        }
        return permittedProcessTypes;
    }

    private void applySupportedProcessTypeScope(QueryWrapper<ApprovalProcess> wrapper,
                                                 Set<String> permittedProcessTypes) {
        if (permittedProcessTypes == null || permittedProcessTypes.isEmpty()) {
            throw new AccessDeniedException("缺少已支持审批流程的业务查询权限");
        }
        StringJoiner placeholders = new StringJoiner(", ");
        for (int index = 0; index < permittedProcessTypes.size(); index++) {
            placeholders.add("{" + index + "}");
        }
        wrapper.apply("UPPER(TRIM(process_type)) IN (" + placeholders + ")", permittedProcessTypes.toArray());
        assetDataPermissionEvaluator.applyToApprovalProcesses(wrapper, permittedProcessTypes);
    }

    private void requireQueryPermissionForType(String processType) {
        requirePermission(permissionForQuery(processType));
    }

    private String permissionForQuery(String processType) {
        return switch (processType) {
            case RETIREMENT_PROCESS_TYPE -> RETIREMENT_QUERY_PERMISSION;
            case WORK_ORDER_PROCESS_TYPE -> WORK_ORDER_QUERY_PERMISSION;
            case COMPENSATION_PROCESS_TYPE -> COMPENSATION_QUERY_PERMISSION;
            case DISPOSAL_PROCESS_TYPE -> DISPOSAL_QUERY_PERMISSION;
            default -> throw new AccessDeniedException("不支持的审批流程类型");
        };
    }

    private String permissionForApprove(String processType) {
        return switch (processType) {
            case RETIREMENT_PROCESS_TYPE -> RETIREMENT_APPROVE_PERMISSION;
            case WORK_ORDER_PROCESS_TYPE -> WORK_ORDER_APPROVE_PERMISSION;
            case COMPENSATION_PROCESS_TYPE -> COMPENSATION_APPROVE_PERMISSION;
            case DISPOSAL_PROCESS_TYPE -> DISPOSAL_APPROVE_PERMISSION;
            default -> throw new AccessDeniedException("不支持的审批流程类型");
        };
    }

    private void requirePermission(String permission) {
        if (!hasPermission(permission)) {
            throw new AccessDeniedException("缺少审批权限: " + permission);
        }
    }

    private boolean hasPermission(String permission) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null
                && !(authentication instanceof AnonymousAuthenticationToken)
                && authentication.isAuthenticated()
                && authentication.getAuthorities().stream()
                .anyMatch(authority -> permission.equals(authority.getAuthority()));
    }

    private String normalizeProcessType(String processType) {
        if (!StringUtils.hasText(processType)) {
            throw new BusinessException("审批流程类型不能为空");
        }
        String normalized = processType.trim().toUpperCase(java.util.Locale.ROOT);
        if (!SUPPORTED_PROCESS_TYPES.contains(normalized)) {
            throw new AccessDeniedException("不支持的审批流程类型: " + processType);
        }
        return normalized;
    }

    private String normalizeOptionalProcessType(String processType) {
        return StringUtils.hasText(processType) ? normalizeProcessType(processType) : null;
    }

    private String normalizeStatus(String status) {
        String normalized = status.trim().toUpperCase(java.util.Locale.ROOT);
        if (!SUPPORTED_PROCESS_STATUSES.contains(normalized)) {
            throw new BusinessException("审批流程状态不支持");
        }
        return normalized;
    }

    private int normalizePage(Integer page) {
        return page == null || page < 1 ? 1 : page;
    }

    private int normalizePageSize(Integer pageSize) {
        if (pageSize == null || pageSize < 1) {
            return 10;
        }
        return Math.min(pageSize, MAX_PAGE_SIZE);
    }

    private int versionOf(Integer version) {
        return version == null ? 0 : version;
    }
}
