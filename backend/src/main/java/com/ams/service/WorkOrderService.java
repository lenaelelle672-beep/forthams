package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.WorkOrderDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.WorkOrder;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.WorkOrderMapper;
import com.ams.security.TenantSecurityAudit;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.List;

@Service
@RequiredArgsConstructor
public class WorkOrderService {

    private static final Logger log = LoggerFactory.getLogger(WorkOrderService.class);

    private final WorkOrderMapper workOrderMapper;
    private final ApprovalProcessMapper approvalProcessMapper;

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
        approvalProcess.setApplicantId(workOrder.getReporterId() != null ? workOrder.getReporterId() : 0L);
        approvalProcess.setApplyTime(LocalDateTime.now());
        approvalProcessMapper.insert(approvalProcess);
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
}
