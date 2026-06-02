package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.WorkOrderDTO;
import com.ams.dto.DeptPendingDTO;
import com.ams.dto.StatusDistributionDTO;

import com.ams.entity.ApprovalProcess;
import com.ams.entity.NotificationRecord;
import com.ams.entity.User;
import com.ams.entity.WorkOrder;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.WorkOrderMapper;
import com.ams.security.TenantSecurityAudit;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

import com.ams.annotation.DataScope;
@Service
@RequiredArgsConstructor
public class WorkOrderService {

    private static final Logger log = LoggerFactory.getLogger(WorkOrderService.class);
    private static final Map<String, String> PRIORITY_ALIASES = Map.of(
            "LOW", "LOW",
            "MEDIUM", "MEDIUM",
            "HIGH", "HIGH",
            "CRITICAL", "CRITICAL",
            "NORMAL", "MEDIUM",
            "URGENT", "HIGH",
            "EMERGENCY", "CRITICAL");
    private static final int MAX_RETRY = 3;

    private final WorkOrderMapper workOrderMapper;
    private final ApprovalProcessMapper approvalProcessMapper;
    private final UserMapper userMapper;
    private final NotificationService notificationService;

    @DataScope(deptColumn = "dept_id", userColumn = "reporter_id")
    public Page<WorkOrder> queryWorkOrders(Integer page, Integer pageSize, String status, String keyword) {
        String tenantId = TenantContext.requireTenantId();
        Page<WorkOrder> pageObj = new Page<>(page, pageSize);
        LambdaQueryWrapper<WorkOrder> wrapper = new LambdaQueryWrapper<WorkOrder>()
                .eq(WorkOrder::getTenantId, tenantId);
        if (StringUtils.hasText(status)) {
            wrapper.eq(WorkOrder::getStatus, status);
        }
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(WorkOrder::getTitle, keyword)
                    .or().like(WorkOrder::getWorkOrderNo, keyword));
        }
        wrapper.orderByDesc(WorkOrder::getCreateTime);
        Page<WorkOrder> result = workOrderMapper.selectPage(pageObj, wrapper);
        result.getRecords().forEach(this::normalizeLoadedWorkOrderPriority);
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkOrder createWorkOrder(WorkOrderDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        WorkOrder workOrder = new WorkOrder();
        BeanUtil.copyProperties(dto, workOrder, "id", "workOrderNo", "status", "createTime", "updateTime");
        workOrder.setPriority(normalizePriorityForWrite(dto.getPriority()));
        workOrder.setTenantId(tenantId);
        workOrder.setStatus("DRAFT");
        int retries = 3;
        while (retries > 0) {
            try {
                workOrder.setWorkOrderNo(generateWorkOrderNo());
                workOrderMapper.insert(workOrder);
                break;
            } catch (Exception e) {
                retries--;
                if (retries == 0) throw e;
                log.warn("工单创建冲突，正在重试: remaining={}", retries);
            }
        }

        sendWorkOrderNotification(workOrder, "创建");
        return workOrder;
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkOrder updateWorkOrder(Long id, WorkOrderDTO dto) {
        WorkOrder workOrder = getWorkOrder(id);
        if (!isEditableStatus(workOrder.getStatus())) {
            throw new BusinessException("只有草稿或已驳回状态的工单可以修改");
        }
        BeanUtil.copyProperties(dto, workOrder, "id", "workOrderNo", "status", "createTime", "updateTime");
        workOrder.setPriority(normalizePriorityForWrite(dto.getPriority()));
        workOrderMapper.updateById(workOrder);
        return workOrder;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteWorkOrder(Long id) {
        String tenantId = TenantContext.requireTenantId();
        // 先查询确保工单存在且属于当前租户
        WorkOrder workOrder = workOrderMapper.selectOne(
                new LambdaQueryWrapper<WorkOrder>()
                        .eq(WorkOrder::getId, id)
                        .eq(WorkOrder::getTenantId, tenantId));
        if (workOrder == null) {
            // 检查是否属于其他租户，记录审计
            WorkOrder existing = workOrderMapper.selectById(id);
            if (existing == null) {
                throw new BusinessException("工单不存在");
            }
            TenantSecurityAudit.logCrossTenantAttempt(log, "deleteWorkOrder", id, tenantId, existing.getTenantId());
            throw new AccessDeniedException("Work order belongs to another tenant");
        }
        if (!isDeletableStatus(workOrder.getStatus())) {
            throw new BusinessException("只有草稿、已驳回或已取消状态的工单可以删除");
        }
        // 使用 LambdaUpdateWrapper 添加 tenantId 条件，确保跨租户安全
        workOrderMapper.delete(new LambdaQueryWrapper<WorkOrder>()
                .eq(WorkOrder::getId, id)
                .eq(WorkOrder::getTenantId, tenantId));
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkOrder submitWorkOrder(Long id) {
        WorkOrder workOrder = getWorkOrder(id);
        if (!isSubmittableStatus(workOrder.getStatus())) {
            throw new BusinessException("只有草稿或已驳回状态的工单可以提交");
        }
        workOrder.setStatus("PENDING");
        workOrderMapper.updateById(workOrder);
        upsertApprovalProcess(workOrder, "PENDING", null);
        return workOrder;
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkOrder operateWorkOrder(Long id, String operation, String comment) {
        WorkOrder workOrder = getWorkOrder(id);
        String normalizedOperation = StringUtils.hasText(operation)
                ? operation.trim().toLowerCase(Locale.ROOT)
                : "";
        switch (normalizedOperation) {
            case "approve":
                if (!"PENDING".equals(workOrder.getStatus())) {
                    throw new BusinessException("只有待审批状态的工单可以审批");
                }
                workOrder.setStatus("APPROVED");
                upsertApprovalProcess(workOrder, "APPROVED", comment);
                break;
            case "reject":
                if (!"PENDING".equals(workOrder.getStatus())) {
                    throw new BusinessException("只有待审批状态的工单可以驳回");
                }
                workOrder.setStatus("REJECTED");
                upsertApprovalProcess(workOrder, "REJECTED", comment);
                break;
            case "start":
                if (!"APPROVED".equals(workOrder.getStatus())) {
                    throw new BusinessException("只有已审批状态的工单可以开始执行");
                }
                workOrder.setStatus("EXECUTING");
                workOrder.setActualStartDate(LocalDateTime.now());
                break;
            case "complete":
                if (!"EXECUTING".equals(workOrder.getStatus())) {
                    throw new BusinessException("只有执行中的工单可以完成");
                }
                workOrder.setStatus("COMPLETED");
                workOrder.setActualEndDate(LocalDateTime.now());
                if (StringUtils.hasText(comment)) {
                    workOrder.setCompletionNote(comment);
                }
                break;
            case "cancel":
                if (!isCancellableStatus(workOrder.getStatus())) {
                    throw new BusinessException("只有草稿或待审批状态的工单可以取消");
                }
                workOrder.setStatus("CANCELLED");
                upsertApprovalProcess(workOrder, "CANCELLED", comment);
                break;
            default:
                throw new BusinessException("不支持的操作: " + operation);
        }
        workOrderMapper.updateById(workOrder);
        return workOrder;
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkOrder applyApprovalOutcome(Long id, String result, String comment) {
        WorkOrder workOrder = getWorkOrder(id);
        if (!"PENDING".equals(workOrder.getStatus())) {
            throw new BusinessException("只有待审批状态的工单可以审批");
        }
        switch (result) {
            case "APPROVED" -> workOrder.setStatus("APPROVED");
            case "REJECTED" -> workOrder.setStatus("REJECTED");
            case "CANCELLED" -> workOrder.setStatus("CANCELLED");
            default -> throw new BusinessException("审批结果无效");
        }
        workOrderMapper.updateById(workOrder);
        upsertApprovalProcess(workOrder, result, comment);
        return workOrder;
    }

    public WorkOrder getWorkOrder(Long id) {
        String tenantId = TenantContext.requireTenantId();
        WorkOrder workOrder = workOrderMapper.selectOne(workOrderById(id, tenantId));
        if (workOrder != null) {
            normalizeLoadedWorkOrderPriority(workOrder);
            return workOrder;
        }

        throw new BusinessException("工单不存在");
    }

    public WorkOrder getWorkOrderById(Long id) {
        return getWorkOrder(id);
    }

    /**
     * 生成工单编号。
     * <p>格式：WO-YYYYMMDD-XXXX（每日从 0001 开始递增）。
     * 使用数据库唯一约束兜底，发生冲突时自动重试。</p>
     */
    private String generateWorkOrderNo() {
        String tenantId = TenantContext.requireTenantId();
        String prefix = "WO-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";
        for (int attempt = 0; attempt < MAX_RETRY; attempt++) {
            try {
                LambdaQueryWrapper<WorkOrder> wrapper = new LambdaQueryWrapper<WorkOrder>()
                        .eq(WorkOrder::getTenantId, tenantId)
                        .likeRight(WorkOrder::getWorkOrderNo, prefix);
                List<WorkOrder> workOrders = workOrderMapper.selectList(wrapper);

                int maxSuffix = 0;
                for (WorkOrder wo : workOrders) {
                    String workOrderNo = wo.getWorkOrderNo();
                    if (workOrderNo != null && workOrderNo.startsWith(prefix)) {
                        try {
                            maxSuffix = Math.max(maxSuffix, Integer.parseInt(workOrderNo.substring(prefix.length())));
                        } catch (NumberFormatException ignored) {
                            // Ignore malformed historical work order numbers.
                        }
                    }
                }
                return prefix + String.format("%04d", maxSuffix + 1);
            } catch (Exception e) {
                log.warn("工单编号生成异常，正在重试 attempt={}", attempt + 1);
                if (attempt == MAX_RETRY - 1) {
                    throw new BusinessException("工单编号生成失败，请稍后重试");
                }
            }
        }
        throw new BusinessException("工单编号生成失败，请稍后重试");
    }

    private void upsertApprovalProcess(WorkOrder workOrder, String status, String comment) {
        if (approvalProcessMapper == null) {
            log.error("审批流程Mapper未注入，无法创建审批记录");
            throw new BusinessException(500, "审批流程配置异常，请联系管理员");
        }

        ApprovalProcess approvalProcess = findApprovalProcess(workOrder.getId());
        if (approvalProcess != null) {
            approvalProcess.setStatus(status);
            approvalProcessMapper.updateById(approvalProcess);
            return;
        }

        for (int attempt = 0; attempt < MAX_RETRY; attempt++) {
            try {
                approvalProcess = new ApprovalProcess();
                approvalProcess.setProcessNo(generateApprovalProcessNo());
                approvalProcess.setProcessType("WORK_ORDER");
                approvalProcess.setBusinessId(workOrder.getId());
                approvalProcess.setTenantId(workOrder.getTenantId());
                approvalProcess.setStatus(status);
                approvalProcess.setCurrentStep(1);
                approvalProcess.setApplicantId(resolveApplicantId(workOrder));
                approvalProcess.setApplyTime(LocalDateTime.now());
                approvalProcessMapper.insert(approvalProcess);
                return;
            } catch (DuplicateKeyException e) {
                log.warn("approval_process_insert_unique_conflict_retry attempt={}", attempt + 1);
                if (attempt == MAX_RETRY - 1) {
                    throw new BusinessException("审批编号生成失败，请稍后重试");
                }
            }
        }
    }

    /**
     * 生成审批流程编号。
     * <p>格式：WOAPR-YYYYMMDD-XXXX（每日从 0001 开始递增）。
     * 使用数据库唯一约束兜底，发生冲突时自动重试。</p>
     */
    private String generateApprovalProcessNo() {
        String tenantId = TenantContext.requireTenantId();
        String prefix = "WOAPR-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";
        for (int attempt = 0; attempt < MAX_RETRY; attempt++) {
            try {
                LambdaQueryWrapper<ApprovalProcess> wrapper = new LambdaQueryWrapper<ApprovalProcess>()
                        .eq(ApprovalProcess::getTenantId, tenantId)
                        .likeRight(ApprovalProcess::getProcessNo, prefix);
                List<ApprovalProcess> processes = approvalProcessMapper.selectList(wrapper);

                int maxSuffix = 0;
                for (ApprovalProcess process : processes == null ? List.<ApprovalProcess>of() : processes) {
                    String processNo = process.getProcessNo();
                    if (processNo != null && processNo.startsWith(prefix)) {
                        try {
                            maxSuffix = Math.max(maxSuffix, Integer.parseInt(processNo.substring(prefix.length())));
                        } catch (NumberFormatException ignored) {
                            // Ignore malformed historical approval process numbers.
                        }
                    }
                }
                return prefix + String.format("%04d", maxSuffix + 1);
            } catch (Exception e) {
                log.warn("审批编号生成异常，正在重试 attempt={}", attempt + 1);
                if (attempt == MAX_RETRY - 1) {
                    throw new BusinessException("审批编号生成失败，请稍后重试");
                }
            }
        }
        throw new BusinessException("审批编号生成失败，请稍后重试");
    }

    /**
     * 优先使用 workOrder.reporterId，其次从 SecurityContext 获取当前认证用户 ID，最终兜底 0L。
     */
    private Long resolveApplicantId(WorkOrder workOrder) {
        if (workOrder.getReporterId() != null) {
            return workOrder.getReporterId();
        }
        Long currentUserId = getCurrentUserIdFromSecurityContext();
        return currentUserId != null ? currentUserId : 0L;
    }

    /**
     * 从 Spring Security SecurityContext 中获取当前认证用户的数据库 ID。
     * Authentication.principal 为 Spring Security User（仅含 username），需通过 UserMapper 反查 ID。
     */
    private Long getCurrentUserIdFromSecurityContext() {
        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
                return null;
            }
            String username = auth.getName();
            User user = userMapper.selectOne(
                    new LambdaQueryWrapper<User>()
                            .eq(User::getUsername, username)
                            .eq(User::getStatus, 1)
                            .last("LIMIT 1")
            );
            return user != null ? user.getId() : null;
        } catch (Exception e) {
            log.warn("failed_to_resolve_current_user_id: {}", e.getMessage());
            return null;
        }
    }

    private ApprovalProcess findApprovalProcess(Long workOrderId) {
        String tenantId = TenantContext.requireTenantId();
        List<ApprovalProcess> processes = approvalProcessMapper.selectList(
                new LambdaQueryWrapper<ApprovalProcess>()
                        .eq(ApprovalProcess::getTenantId, tenantId)
                        .eq(ApprovalProcess::getProcessType, "WORK_ORDER")
                        .eq(ApprovalProcess::getBusinessId, workOrderId)
                        .orderByDesc(ApprovalProcess::getCreateTime));
        return processes == null || processes.isEmpty() ? null : processes.get(0);
    }

    private String normalizePriorityForWrite(String priority) {
        String normalized = normalizePriorityAlias(priority);
        if (normalized != null) {
            return normalized;
        }
        if (!StringUtils.hasText(priority)) {
            return "MEDIUM";
        }
        throw new BusinessException("工单优先级无效");
    }

    private void normalizeLoadedWorkOrderPriority(WorkOrder workOrder) {
        if (workOrder == null || !StringUtils.hasText(workOrder.getPriority())) {
            return;
        }
        String normalized = normalizePriorityAlias(workOrder.getPriority());
        if (normalized != null) {
            workOrder.setPriority(normalized);
        }
    }

    private String normalizePriorityAlias(String priority) {
        if (!StringUtils.hasText(priority)) {
            return null;
        }
        return PRIORITY_ALIASES.get(priority.trim().toUpperCase(Locale.ROOT));
    }

    private boolean isEditableStatus(String status) {
        return "DRAFT".equals(status) || "REJECTED".equals(status);
    }

    private boolean isSubmittableStatus(String status) {
        return isEditableStatus(status);
    }

    private boolean isDeletableStatus(String status) {
        return isEditableStatus(status) || "CANCELLED".equals(status);
    }

    private boolean isCancellableStatus(String status) {
        return "DRAFT".equals(status) || "PENDING".equals(status);
    }

    private LambdaQueryWrapper<WorkOrder> workOrderById(Long id, String tenantId) {
        return new LambdaQueryWrapper<WorkOrder>()
                .eq(WorkOrder::getId, id)
                .eq(WorkOrder::getTenantId, tenantId);
    }

    /**
     * 工单操作完成后发送通知给相关用户
     */
    private void sendWorkOrderNotification(WorkOrder workOrder, String action) {
        try {
            Long reporterId = workOrder.getReporterId();
            Long operatorId = getCurrentUserIdFromSecurityContext();
            // 通知工单创建人（如果操作人不是创建人自己）
            Long notifyUserId = reporterId;
            if (notifyUserId == null) {
                return;
            }
            if (operatorId != null && operatorId.equals(notifyUserId)) {
                return;
            }
            NotificationRecord notification = new NotificationRecord();
            notification.setUserId(notifyUserId);
            notification.setTitle("工单通知");
            notification.setContent("工单「" + (workOrder.getTitle() != null ? workOrder.getTitle() : workOrder.getWorkOrderNo()) + "」已被" + action);
            notification.setType("WORK_ORDER");
            notification.setCategory("OPERATION");
            notification.setRefId(workOrder.getId());
            notification.setRefType("WORK_ORDER");
            notificationService.create(notification);
        } catch (Exception e) {
            log.warn("发送工单通知失败: {}", e.getMessage());
        }
    }

    /**
     * 获取工单状态分布统计。
     *
     * <p>使用 SQL GROUP BY 查询替代全量+内存分组，提升性能。
     *
     * @return 各状态工单计数列表
     */
    public List<StatusDistributionDTO> getStatusDistribution() {
        String tenantId = TenantContext.requireTenantId();
        try {
            List<StatusDistributionDTO> list = workOrderMapper.selectStatusDistribution(tenantId);
            Map<String, String> statusLabels = new HashMap<>();
            statusLabels.put("COMPLETED", "已完成");
            statusLabels.put("EXECUTING", "进行中");
            statusLabels.put("PENDING", "待处理");
            statusLabels.put("APPROVED", "已审批");
            statusLabels.put("DRAFT", "草稿");
            statusLabels.put("REJECTED", "已驳回");
            statusLabels.put("CANCELLED", "已取消");
            for (StatusDistributionDTO item : list) {
                item.setName(statusLabels.getOrDefault(item.getName(), item.getName()));
            }
            return list;
        } catch (Exception e) {
            log.warn("failed_to_query_status_distribution: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    /**
     * 获取各部门待处理工单数量。
     *
     * <p>使用 SQL GROUP BY 查询替代全量+内存分组，提升性能。
     *
     * @return 各部门待处理工单计数列表
     */
    public List<DeptPendingDTO> getDeptPending() {
        String tenantId = TenantContext.requireTenantId();
        try {
            return workOrderMapper.selectDeptPending(tenantId);
        } catch (Exception e) {
            log.warn("failed_to_query_dept_pending: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

}
