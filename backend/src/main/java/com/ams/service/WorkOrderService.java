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
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
        return workOrderMapper.selectPage(pageObj, wrapper);
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkOrder createWorkOrder(WorkOrderDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        WorkOrder workOrder = new WorkOrder();
        BeanUtil.copyProperties(dto, workOrder, "id", "workOrderNo", "status", "createTime", "updateTime");
        workOrder.setTenantId(tenantId);
        workOrder.setWorkOrderNo(generateWorkOrderNo());
        workOrder.setStatus("DRAFT");
        workOrderMapper.insert(workOrder);

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
        workOrderMapper.updateById(workOrder);
        return workOrder;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteWorkOrder(Long id) {
        WorkOrder workOrder = getWorkOrder(id);
        if (!isDeletableStatus(workOrder.getStatus())) {
            throw new BusinessException("只有草稿、已驳回或已取消状态的工单可以删除");
        }
        workOrderMapper.deleteById(id);
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
                    throw new BusinessException("只有草稿、待审批或已审批状态的工单可以取消");
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
        if ("APPROVED".equals(result)) {
            workOrder.setStatus("APPROVED");
        } else if ("REJECTED".equals(result)) {
            workOrder.setStatus("REJECTED");
        } else {
            throw new BusinessException("审批结果无效");
        }
        workOrderMapper.updateById(workOrder);
        upsertApprovalProcess(workOrder, result, comment);
        return workOrder;
    }

    public WorkOrder getWorkOrder(Long id) {
        String tenantId = TenantContext.requireTenantId();
        WorkOrder workOrder = workOrderMapper.selectOne(workOrderById(id, tenantId));
        if (workOrder != null) {
            return workOrder;
        }

        WorkOrder existingWorkOrder = workOrderMapper.selectById(id);
        if (existingWorkOrder == null) {
            throw new BusinessException("工单不存在");
        }
        TenantSecurityAudit.logCrossTenantAttempt(log, "getWorkOrder", id, tenantId, existingWorkOrder.getTenantId());
        throw new AccessDeniedException("Work order belongs to another tenant");
    }

    public WorkOrder getWorkOrderById(Long id) {
        return getWorkOrder(id);
    }

    private synchronized String generateWorkOrderNo() {
        String tenantId = TenantContext.requireTenantId();
        String prefix = "WO-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";
        LambdaQueryWrapper<WorkOrder> wrapper = new LambdaQueryWrapper<WorkOrder>()
                .eq(WorkOrder::getTenantId, tenantId)
                .likeRight(WorkOrder::getWorkOrderNo, prefix);
        List<WorkOrder> workOrders = workOrderMapper.selectList(wrapper);

        int maxSuffix = 0;
        for (WorkOrder workOrder : workOrders) {
            String workOrderNo = workOrder.getWorkOrderNo();
            if (workOrderNo != null && workOrderNo.startsWith(prefix)) {
                try {
                    maxSuffix = Math.max(maxSuffix, Integer.parseInt(workOrderNo.substring(prefix.length())));
                } catch (NumberFormatException ignored) {
                    // Ignore malformed historical work order numbers.
                }
            }
        }
        return prefix + String.format("%04d", maxSuffix + 1);
    }

    private void upsertApprovalProcess(WorkOrder workOrder, String status, String comment) {
        if (approvalProcessMapper == null) {
            return;
        }

        ApprovalProcess approvalProcess = findApprovalProcess(workOrder.getId());
        if (approvalProcess != null) {
            approvalProcess.setStatus(status);
            approvalProcess.setBusinessData(comment);
            approvalProcessMapper.updateById(approvalProcess);
            return;
        }

        approvalProcess = new ApprovalProcess();
        approvalProcess.setProcessNo(generateApprovalProcessNo());
        approvalProcess.setProcessType("WORK_ORDER");
        approvalProcess.setBusinessId(workOrder.getId());
        approvalProcess.setBusinessData(comment);
        approvalProcess.setTenantId(workOrder.getTenantId());
        approvalProcess.setStatus(status);
        approvalProcess.setCurrentStep(1);
        approvalProcess.setApplicantId(resolveApplicantId(workOrder));
        approvalProcess.setApplyTime(LocalDateTime.now());
        approvalProcessMapper.insert(approvalProcess);
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

    private synchronized String generateApprovalProcessNo() {
        String tenantId = TenantContext.requireTenantId();
        String prefix = "WOAPR-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-";
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
        return "DRAFT".equals(status) || "PENDING".equals(status) || "APPROVED".equals(status);
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
     * <p>查询当前租户下所有工单，按状态分组计数。
     *
     * @return 各状态工单计数列表（如 已完成、进行中、待处理 等）
     */
    public List<StatusDistributionDTO> getStatusDistribution() {
        String tenantId = TenantContext.requireTenantId();
        try {
            List<WorkOrder> allOrders = workOrderMapper.selectList(
                    new LambdaQueryWrapper<WorkOrder>()
                            .eq(WorkOrder::getTenantId, tenantId)
                            .select(WorkOrder::getStatus));

            Map<String, Long> statusMap = new HashMap<>();
            for (WorkOrder wo : allOrders) {
                String status = wo.getStatus() != null ? wo.getStatus() : "UNKNOWN";
                statusMap.merge(status, 1L, Long::sum);
            }

            Map<String, String> statusLabels = new HashMap<>();
            statusLabels.put("COMPLETED", "已完成");
            statusLabels.put("EXECUTING", "进行中");
            statusLabels.put("PENDING", "待处理");
            statusLabels.put("APPROVED", "已审批");
            statusLabels.put("DRAFT", "草稿");
            statusLabels.put("REJECTED", "已驳回");
            statusLabels.put("CANCELLED", "已取消");

            List<StatusDistributionDTO> result = new ArrayList<>();
            for (Map.Entry<String, Long> entry : statusMap.entrySet()) {
                result.add(StatusDistributionDTO.builder()
                        .name(statusLabels.getOrDefault(entry.getKey(), entry.getKey()))
                        .value(entry.getValue())
                        .build());
            }

            return result;
        } catch (Exception e) {
            log.warn("failed_to_query_status_distribution: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    /**
     * 获取各部门待处理工单数量。
     *
     * <p>查询当前租户下所有 PENDING 状态工单，按 deptName 分组计数。
     *
     * @return 各部门待处理工单计数列表
     */
    public List<DeptPendingDTO> getDeptPending() {
        String tenantId = TenantContext.requireTenantId();
        try {
            List<WorkOrder> pendingOrders = workOrderMapper.selectList(
                    new LambdaQueryWrapper<WorkOrder>()
                            .eq(WorkOrder::getTenantId, tenantId)
                            .eq(WorkOrder::getStatus, "PENDING")
                            .select(WorkOrder::getDeptName));

            Map<String, Long> deptMap = new HashMap<>();
            for (WorkOrder wo : pendingOrders) {
                String deptName = wo.getDeptName() != null ? wo.getDeptName() : "未知部门";
                deptMap.merge(deptName, 1L, Long::sum);
            }

            List<DeptPendingDTO> result = new ArrayList<>();
            for (Map.Entry<String, Long> entry : deptMap.entrySet()) {
                result.add(DeptPendingDTO.builder()
                        .name(entry.getKey())
                        .value(entry.getValue())
                        .build());
            }

            return result;
        } catch (Exception e) {
            log.warn("failed_to_query_dept_pending: {}", e.getMessage());
            return new ArrayList<>();
        }
    }


}
