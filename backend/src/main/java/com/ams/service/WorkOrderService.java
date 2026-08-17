package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.WorkOrderDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.Asset;
import com.ams.entity.Dept;
import com.ams.entity.User;
import com.ams.entity.WorkOrder;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.ams.mapper.WorkOrderMapper;
import com.ams.security.TenantSecurityAudit;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkOrderService {

    private static final Logger log = LoggerFactory.getLogger(WorkOrderService.class);
    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> WORK_ORDER_STATUSES = Set.of(
            "DRAFT", "PENDING", "APPROVED", "EXECUTING", "COMPLETED", "REJECTED",
            "CANCELLED_REQUIRES_RESUBMISSION", "CANCELLED");

    private final WorkOrderMapper workOrderMapper;
    private final ApprovalProcessMapper approvalProcessMapper;
    private final AssetMapper assetMapper;
    private final AssetDataPermissionEvaluator assetDataPermissionEvaluator;
    private final TenantAuthorityService tenantAuthorityService;
    private final UserMapper userMapper;
    private final DeptMapper deptMapper;
    private final UserTenantMembershipMapper userTenantMembershipMapper;
    private final ApprovalAssignmentService approvalAssignmentService;

    public Page<WorkOrder> queryWorkOrders(Integer page, Integer pageSize, String status, String keyword) {
        requirePermission("workorder:query");
        String tenantId = TenantContext.requireTenantId();
        Page<WorkOrder> pageObj = new Page<>(normalizePage(page), normalizePageSize(pageSize));
        LambdaQueryWrapper<WorkOrder> wrapper = new LambdaQueryWrapper<WorkOrder>()
                .eq(WorkOrder::getTenantId, tenantId);
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        if (StringUtils.hasText(status)) {
            wrapper.eq(WorkOrder::getStatus, normalizeStatus(status));
        }
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(WorkOrder::getTitle, keyword)
                    .or().like(WorkOrder::getWorkOrderNo, keyword));
        }
        wrapper.orderByDesc(WorkOrder::getCreateTime);
        return workOrderMapper.selectPage(pageObj, wrapper);
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkOrder createWorkOrder(WorkOrderDTO dto) {
        requirePermission("workorder:create");
        validateCreateDTO(dto);
        String tenantId = TenantContext.requireTenantId();
        Asset linkedAsset = loadAccessibleAsset(dto.getAssetId(), tenantId, "createWorkOrder");
        User currentUser = tenantAuthorityService.requireCurrentTenantMember();
        if (currentUser.getId() == null) {
            throw new AccessDeniedException("当前租户成员无效");
        }
        WorkOrder workOrder = new WorkOrder();
        BeanUtil.copyProperties(dto, workOrder, "id", "workOrderNo", "status", "createTime", "updateTime",
                "assetId", "assetName", "assetCode", "reporterId", "reporterName", "assigneeName", "deptName",
                "actualStartDate", "actualEndDate", "completionNote", "version");
        workOrder.setTenantId(tenantId);
        workOrder.setAssetId(linkedAsset.getId());
        workOrder.setAssetName(linkedAsset.getAssetName());
        workOrder.setAssetCode(linkedAsset.getAssetNo());
        workOrder.setReporterId(currentUser.getId());
        workOrder.setReporterName(currentUser.getRealName());
        workOrder.setWorkOrderNo(generateWorkOrderNo());
        workOrder.setStatus("DRAFT");
        workOrder.setVersion(0);
        populateTenantAssignments(workOrder, tenantId);
        if (workOrderMapper.insert(workOrder) != 1) {
            throw new BusinessException("工单创建失败");
        }
        return workOrder;
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkOrder updateWorkOrder(Long id, WorkOrderDTO dto) {
        requirePermission("workorder:update");
        if (dto == null) {
            throw new BusinessException("工单更新参数不能为空");
        }
        WorkOrder workOrder = getWorkOrderInternal(id);
        String expectedStatus = normalizeStatus(workOrder.getStatus());
        if (!isEditableStatus(expectedStatus)) {
            throw new BusinessException("只有草稿、已驳回或需重提状态的工单可以修改");
        }
        Long sourceAssetId = workOrder.getAssetId();
        Long targetAssetId = dto.getAssetId() == null ? sourceAssetId : dto.getAssetId();
        Asset linkedAsset = loadAccessibleAsset(targetAssetId, TenantContext.requireTenantId(), "updateWorkOrder");
        BeanUtil.copyProperties(dto, workOrder, "id", "workOrderNo", "status", "createTime", "updateTime",
                "assetId", "assetName", "assetCode", "reporterId", "reporterName", "assigneeName", "deptName",
                "actualStartDate", "actualEndDate", "completionNote", "version");
        workOrder.setAssetId(linkedAsset.getId());
        workOrder.setAssetName(linkedAsset.getAssetName());
        workOrder.setAssetCode(linkedAsset.getAssetNo());
        populateTenantAssignments(workOrder, TenantContext.requireTenantId());
        updateWorkOrderAtomically(workOrder, expectedStatus, sourceAssetId);
        return workOrder;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteWorkOrder(Long id) {
        requirePermission("workorder:delete");
        WorkOrder workOrder = getWorkOrderInternal(id);
        String expectedStatus = normalizeStatus(workOrder.getStatus());
        if (!isDeletableStatus(expectedStatus)) {
            throw new BusinessException("只有草稿、已驳回或已取消状态的工单可以删除");
        }
        if (findPendingApprovalProcess(workOrder.getId(), false) != null) {
            throw new BusinessException("存在进行中的工单审批流程，不能删除工单");
        }
        LambdaQueryWrapper<WorkOrder> wrapper = new LambdaQueryWrapper<WorkOrder>()
                .eq(WorkOrder::getId, id)
                .eq(WorkOrder::getTenantId, TenantContext.requireTenantId())
                .eq(WorkOrder::getAssetId, workOrder.getAssetId())
                .eq(WorkOrder::getStatus, expectedStatus)
                .eq(WorkOrder::getVersion, versionOf(workOrder.getVersion()));
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        if (workOrderMapper.delete(wrapper) != 1) {
            throw new BusinessException("工单已变更，请刷新后重试");
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkOrder submitWorkOrder(Long id) {
        requirePermission("workorder:submit");
        WorkOrder workOrder = getWorkOrderInternal(id);
        String expectedStatus = normalizeStatus(workOrder.getStatus());
        if (!isSubmittableStatus(expectedStatus)) {
            throw new BusinessException("只有草稿、已驳回或需重提状态的工单可以提交");
        }
        workOrder.setStatus("PENDING");
        updateWorkOrderAtomically(workOrder, expectedStatus, workOrder.getAssetId());
        createPendingApprovalProcess(workOrder);
        return workOrder;
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkOrder operateWorkOrder(Long id, String operation, String comment) {
        WorkOrder workOrder = getWorkOrderInternal(id);
        String normalizedOperation = StringUtils.hasText(operation)
                ? operation.trim().toLowerCase(Locale.ROOT)
                : "";
        requireOperationPermission(normalizedOperation);
        String expectedStatus = normalizeStatus(workOrder.getStatus());
        switch (normalizedOperation) {
            case "approve", "reject" -> throw new AccessDeniedException("工单审批必须通过受控审批流程处理");
            case "start" -> {
                if (!"APPROVED".equals(expectedStatus)) {
                    throw new BusinessException("只有已审批状态的工单可以开始执行");
                }
                workOrder.setStatus("EXECUTING");
                workOrder.setActualStartDate(LocalDateTime.now());
            }
            case "complete" -> {
                if (!"EXECUTING".equals(expectedStatus)) {
                    throw new BusinessException("只有执行中的工单可以完成");
                }
                workOrder.setStatus("COMPLETED");
                workOrder.setActualEndDate(LocalDateTime.now());
                if (StringUtils.hasText(comment)) {
                    workOrder.setCompletionNote(comment);
                }
            }
            case "cancel" -> {
                if (!isCancellableStatus(expectedStatus)) {
                    throw new BusinessException("只有草稿、待审批、需重提或已审批状态的工单可以取消");
                }
                workOrder.setStatus("CANCELLED");
            }
            default -> throw new BusinessException("不支持的操作: " + operation);
        }
        if ("cancel".equals(normalizedOperation) && "PENDING".equals(expectedStatus)) {
            cancelPendingApprovalProcess(workOrder, comment);
        }
        updateWorkOrderAtomically(workOrder, expectedStatus, workOrder.getAssetId());
        return workOrder;
    }

    @Transactional(rollbackFor = Exception.class)
    WorkOrder applyApprovalOutcome(Long id, String result, String comment) {
        requirePermission("approval:approve");
        requirePermission("workorder:approve");
        WorkOrder workOrder = getWorkOrderInternal(id);
        String expectedStatus = normalizeStatus(workOrder.getStatus());
        if (!"PENDING".equals(expectedStatus)) {
            throw new BusinessException("只有待审批状态的工单可以审批");
        }
        if ("APPROVED".equals(result) || "REJECTED".equals(result)) {
            workOrder.setStatus(result);
        } else {
            throw new BusinessException("审批结果无效");
        }
        updateWorkOrderAtomically(workOrder, expectedStatus, workOrder.getAssetId());
        return workOrder;
    }

    WorkOrder getWorkOrder(Long id) {
        return getWorkOrderInternal(id);
    }

    public WorkOrder getWorkOrderById(Long id) {
        requirePermission("workorder:query");
        return getWorkOrderInternal(id);
    }

    private WorkOrder getWorkOrderInternal(Long id) {
        String tenantId = TenantContext.requireTenantId();
        WorkOrder workOrder = workOrderMapper.selectOne(workOrderById(id, tenantId));
        if (workOrder != null) {
            loadAccessibleAsset(workOrder.getAssetId(), tenantId, "getWorkOrder");
            return workOrder;
        }

        WorkOrder existingWorkOrder = workOrderMapper.selectById(id);
        if (existingWorkOrder == null) {
            throw new BusinessException("工单不存在");
        }
        TenantSecurityAudit.logCrossTenantAttempt(log, "getWorkOrder", id, tenantId, existingWorkOrder.getTenantId());
        throw new AccessDeniedException("工单不属于当前租户");
    }

    private String generateWorkOrderNo() {
        return "WO-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-"
                + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private void createPendingApprovalProcess(WorkOrder workOrder) {
        if (findPendingApprovalProcess(workOrder.getId(), false) != null) {
            throw new BusinessException("工单已有进行中的审批流程");
        }

        ApprovalProcess approvalProcess = new ApprovalProcess();
        approvalProcess.setProcessNo("WOAPR-" + UUID.randomUUID());
        approvalProcess.setProcessType("WORK_ORDER");
        approvalProcess.setBusinessId(workOrder.getId());
        approvalProcess.setTenantId(workOrder.getTenantId());
        approvalProcess.setStatus("PENDING");
        approvalProcess.setCurrentStep(1);
        approvalProcess.setApplicantId(workOrder.getReporterId());
        approvalProcess.setApplyTime(LocalDateTime.now());
        approvalProcess.setVersion(0);
        if (approvalProcessMapper.insert(approvalProcess) != 1 || approvalProcess.getId() == null) {
            throw new BusinessException("工单审批流程创建失败");
        }
        approvalAssignmentService.initializeForProcess(approvalProcess, "WORK_ORDER");
    }

    private void cancelPendingApprovalProcess(WorkOrder workOrder, String comment) {
        ApprovalProcess approvalProcess = findPendingApprovalProcess(workOrder.getId(), true);
        if (approvalProcess == null) {
            throw new BusinessException("进行中的工单审批流程不存在或已变更，请刷新后重试");
        }
        int version = versionOf(approvalProcess.getVersion());
        ApprovalProcess update = new ApprovalProcess();
        update.setStatus("CANCELLED");
        update.setBusinessData(comment);
        update.setVersion(version + 1);
        int updated = approvalProcessMapper.update(update, new LambdaUpdateWrapper<ApprovalProcess>()
                .eq(ApprovalProcess::getId, approvalProcess.getId())
                .eq(ApprovalProcess::getTenantId, workOrder.getTenantId())
                .eq(ApprovalProcess::getProcessType, "WORK_ORDER")
                .eq(ApprovalProcess::getBusinessId, workOrder.getId())
                .eq(ApprovalProcess::getStatus, "PENDING")
                .eq(ApprovalProcess::getVersion, version));
        if (updated != 1) {
            throw new BusinessException("审批流程已变更，请刷新后重试");
        }
        approvalAssignmentService.freezePendingAssignments(approvalProcess.getId());
    }

    private ApprovalProcess findPendingApprovalProcess(Long workOrderId, boolean lockForUpdate) {
        LambdaQueryWrapper<ApprovalProcess> wrapper = new LambdaQueryWrapper<ApprovalProcess>()
                .eq(ApprovalProcess::getTenantId, TenantContext.requireTenantId())
                .eq(ApprovalProcess::getProcessType, "WORK_ORDER")
                .eq(ApprovalProcess::getBusinessId, workOrderId)
                .eq(ApprovalProcess::getStatus, "PENDING")
                .orderByDesc(ApprovalProcess::getCreateTime)
                .orderByDesc(ApprovalProcess::getId)
                .last(lockForUpdate ? "limit 1 FOR UPDATE" : "limit 1");
        return approvalProcessMapper.selectOne(wrapper);
    }

    private void updateWorkOrderAtomically(WorkOrder workOrder, String expectedStatus, Long sourceAssetId) {
        int version = versionOf(workOrder.getVersion());
        workOrder.setVersion(version + 1);
        LambdaUpdateWrapper<WorkOrder> wrapper = new LambdaUpdateWrapper<WorkOrder>()
                .eq(WorkOrder::getId, workOrder.getId())
                .eq(WorkOrder::getTenantId, TenantContext.requireTenantId())
                .eq(WorkOrder::getAssetId, sourceAssetId)
                .eq(WorkOrder::getStatus, expectedStatus)
                .eq(WorkOrder::getVersion, version);
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        if (workOrderMapper.update(workOrder, wrapper) != 1) {
            throw new BusinessException("工单已变更，请刷新后重试");
        }
    }

    private void populateTenantAssignments(WorkOrder workOrder, String tenantId) {
        if (workOrder.getDeptId() != null) {
            Dept department = deptMapper.selectOne(new QueryWrapper<Dept>()
                    .eq("id", workOrder.getDeptId())
                    .eq("tenant_id", tenantId)
                    .eq("deleted", 0)
                    .last("limit 1"));
            if (department == null || !("1".equals(department.getStatus())
                    || "ACTIVE".equalsIgnoreCase(department.getStatus()))) {
                throw new AccessDeniedException("工单部门不存在、已停用或不属于当前租户");
            }
            workOrder.setDeptName(department.getName());
        } else {
            workOrder.setDeptName(null);
        }
        if (workOrder.getAssigneeId() == null) {
            workOrder.setAssigneeName(null);
            return;
        }
        User assignee = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getId, workOrder.getAssigneeId())
                .eq(User::getTenantId, tenantId)
                .eq(User::getStatus, 1)
                .eq(User::getDeleted, 0)
                .last("limit 1"));
        if (assignee == null || assignee.getId() == null
                || userTenantMembershipMapper.countActiveMembership(assignee.getId(), tenantId) != 1) {
            throw new AccessDeniedException("工单处理人不存在或不属于当前租户");
        }
        if (workOrder.getDeptId() != null && !workOrder.getDeptId().equals(assignee.getDeptId())) {
            throw new AccessDeniedException("工单处理人不属于指定部门");
        }
        workOrder.setAssigneeName(assignee.getRealName());
    }

    private void validateCreateDTO(WorkOrderDTO dto) {
        if (dto == null || dto.getAssetId() == null || dto.getAssetId() <= 0
                || !StringUtils.hasText(dto.getTitle())) {
            throw new BusinessException("工单标题和关联资产不能为空");
        }
    }

    private boolean isEditableStatus(String status) {
        return "DRAFT".equals(status) || "REJECTED".equals(status)
                || "CANCELLED_REQUIRES_RESUBMISSION".equals(status);
    }

    private boolean isSubmittableStatus(String status) {
        return isEditableStatus(status);
    }

    private boolean isDeletableStatus(String status) {
        return isEditableStatus(status) || "CANCELLED".equals(status);
    }

    private boolean isCancellableStatus(String status) {
        return "DRAFT".equals(status) || "PENDING".equals(status) || "APPROVED".equals(status)
                || "CANCELLED_REQUIRES_RESUBMISSION".equals(status);
    }

    private Asset loadAccessibleAsset(Long assetId, String tenantId, String operation) {
        if (assetId == null || assetId <= 0) {
            throw new BusinessException("工单必须关联有效资产");
        }
        Asset asset = assetMapper.selectOne(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getId, assetId)
                .eq(Asset::getTenantId, tenantId));
        if (asset == null) {
            Asset existingAsset = assetMapper.selectById(assetId);
            if (existingAsset == null) {
                throw new BusinessException("关联资产不存在");
            }
            TenantSecurityAudit.logCrossTenantAttempt(log, operation, assetId, tenantId, existingAsset.getTenantId());
            throw new AccessDeniedException("关联资产不属于当前租户");
        }
        assetDataPermissionEvaluator.assertCanAccess(asset);
        return asset;
    }

    private void requireOperationPermission(String operation) {
        String permission = switch (operation) {
            case "approve", "reject" -> "workorder:approve";
            case "start", "complete" -> "workorder:execute";
            case "cancel" -> "workorder:cancel";
            default -> throw new BusinessException("不支持的操作: " + operation);
        };
        requirePermission(permission);
    }

    private void requirePermission(String permission) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean allowed = authentication != null
                && !(authentication instanceof AnonymousAuthenticationToken)
                && authentication.isAuthenticated()
                && authentication.getAuthorities().stream()
                .anyMatch(authority -> permission.equals(authority.getAuthority()));
        if (!allowed) {
            throw new AccessDeniedException("缺少工单权限: " + permission);
        }
    }

    private String normalizeStatus(String status) {
        if (!StringUtils.hasText(status)) {
            throw new BusinessException("工单状态不能为空");
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!WORK_ORDER_STATUSES.contains(normalized)) {
            throw new BusinessException("工单状态无效");
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

    private LambdaQueryWrapper<WorkOrder> workOrderById(Long id, String tenantId) {
        LambdaQueryWrapper<WorkOrder> wrapper = new LambdaQueryWrapper<WorkOrder>()
                .eq(WorkOrder::getId, id)
                .eq(WorkOrder::getTenantId, tenantId);
        assetDataPermissionEvaluator.applyToRelatedAsset(wrapper);
        return wrapper;
    }
}
