package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.ApprovalCreateDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.ApprovalRecord;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.ApprovalRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ApprovalService {

    private static final int FINAL_STEP = 3;

    private final ApprovalProcessMapper approvalProcessMapper;
    private final ApprovalRecordMapper approvalRecordMapper;
    private final RetirementApplicationService retirementApplicationService;
    private final WorkOrderService workOrderService;

    public Page<ApprovalProcess> queryProcesses(Integer page, Integer pageSize, String status, String processType) {
        String tenantId = TenantContext.requireTenantId();
        Page<ApprovalProcess> pageParam = new Page<>(page, pageSize);
        QueryWrapper<ApprovalProcess> wrapper = new QueryWrapper<>();
        wrapper.eq("tenant_id", tenantId);

        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        if (processType != null && !processType.isEmpty()) {
            wrapper.eq("process_type", processType);
        }
        wrapper.orderByDesc("create_time");

        return approvalProcessMapper.selectPage(pageParam, wrapper);
    }

    public Map<String, Object> getProcessById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        ApprovalProcess process = approvalProcessMapper.selectOne(new QueryWrapper<ApprovalProcess>()
                .eq("id", id)
                .eq("tenant_id", tenantId)
                .last("limit 1"));
        if (process == null) {
            throw new BusinessException("审批流程不存在");
        }

        List<ApprovalRecord> records = approvalRecordMapper.selectList(
            new QueryWrapper<ApprovalRecord>()
                .eq("process_id", id)
                .eq("tenant_id", tenantId)
                .orderByAsc("step_no")
                .orderByAsc("create_time")
        );

        Map<String, Object> result = new HashMap<>();
        result.put("process", process);
        result.put("records", records);
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public ApprovalProcess createProcess(ApprovalCreateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        ApprovalProcess process = new ApprovalProcess();
        BeanUtil.copyProperties(dto, process);
        BeanUtil.setProperty(process, "tenantId", tenantId);
        BeanUtil.setProperty(process, "processNo", generateProcessNo());
        BeanUtil.setProperty(process, "status", "PENDING");
        BeanUtil.setProperty(process, "currentStep", 1);
        BeanUtil.setProperty(process, "applyTime", LocalDateTime.now());

        approvalProcessMapper.insert(process);
        return process;
    }

    @Transactional(rollbackFor = Exception.class)
    public ApprovalProcess approve(Long processId, Long approverId, String result, String opinion) {
        String tenantId = TenantContext.requireTenantId();
        ApprovalProcess process = approvalProcessMapper.selectOne(new QueryWrapper<ApprovalProcess>()
                .eq("id", processId)
                .eq("tenant_id", tenantId)
                .last("limit 1"));
        if (process == null) {
            throw new BusinessException("审批流程不存在");
        }
        if (!"PENDING".equals(BeanUtil.getProperty(process, "status"))) {
            throw new BusinessException("当前流程不可审批");
        }

        ApprovalRecord record = new ApprovalRecord();
        BeanUtil.setProperty(record, "processId", processId);
        BeanUtil.setProperty(record, "tenantId", tenantId);
        Integer currentStep = parseInteger(BeanUtil.getProperty(process, "currentStep"), 1);
        int finalStep = resolveFinalStep(process);
        BeanUtil.setProperty(record, "stepNo", currentStep);
        BeanUtil.setProperty(record, "approverId", approverId);
        BeanUtil.setProperty(record, "approveResult", result);
        BeanUtil.setProperty(record, "approveOpinion", opinion);
        BeanUtil.setProperty(record, "approveTime", LocalDateTime.now());
        approvalRecordMapper.insert(record);

        if ("REJECTED".equals(result)) {
            BeanUtil.setProperty(process, "status", "REJECTED");
        } else if ("APPROVED".equals(result)) {
            if (currentStep >= finalStep) {
                BeanUtil.setProperty(process, "status", "APPROVED");
            } else {
                BeanUtil.setProperty(process, "currentStep", currentStep + 1);
            }
        } else {
            throw new BusinessException("审批结果无效");
        }

        approvalProcessMapper.updateById(process);
        handleBusinessOutcome(process, approverId, result, opinion);
        return process;
    }

    public List<ApprovalProcess> getMyPendingApprovals(Long approverId) {
        String tenantId = TenantContext.requireTenantId();
        List<ApprovalProcess> pendingList = approvalProcessMapper.selectList(
            new QueryWrapper<ApprovalProcess>()
                .eq("tenant_id", tenantId)
                .eq("status", "PENDING")
                .orderByDesc("create_time")
        );

        if (approverId == null || pendingList.isEmpty()) {
            return pendingList;
        }

        List<ApprovalRecord> myRecords = approvalRecordMapper.selectList(
            new QueryWrapper<ApprovalRecord>()
                .eq("tenant_id", tenantId)
                .eq("approver_id", approverId)
        );

        if (myRecords.isEmpty()) {
            return pendingList;
        }

        Set<Long> processedIds = myRecords.stream()
            .map(item -> parseLong(BeanUtil.getProperty(item, "processId"), null))
            .filter(id -> id != null)
            .collect(Collectors.toSet());
        return pendingList.stream()
            .filter(item -> {
                Long id = parseLong(BeanUtil.getProperty(item, "id"), null);
                return id == null || !processedIds.contains(id);
            })
            .collect(Collectors.toList());
    }

    public Long getPendingCount() {
        String tenantId = TenantContext.requireTenantId();
        return approvalProcessMapper.selectCount(
            new QueryWrapper<ApprovalProcess>()
                    .eq("tenant_id", tenantId)
                    .eq("status", "PENDING")
        );
    }

    private String generateProcessNo() {
        String tenantId = TenantContext.requireTenantId();
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "APR-" + dateStr + "-";

        Long count = approvalProcessMapper.selectCount(
            new QueryWrapper<ApprovalProcess>()
                .eq("tenant_id", tenantId)
                .likeRight("process_no", prefix)
        );
        long sequence = (count == null ? 0 : count) + 1;
        return prefix + String.format("%03d", sequence);
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

    private Long parseLong(Object value, Long defaultValue) {
        if (value == null) {
            return defaultValue;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }

        String text = String.valueOf(value);
        if (text.isEmpty()) {
            return defaultValue;
        }
        try {
            return Long.parseLong(text);
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
    }

    private int resolveFinalStep(ApprovalProcess process) {
        if ("RETIREMENT".equals(process.getProcessType()) && process.getBusinessId() != null) {
            return retirementApplicationService.getApprovalStepCount(process.getBusinessId());
        }
        if ("WORK_ORDER".equals(process.getProcessType())) {
            return 1;
        }
        return FINAL_STEP;
    }

    private void handleBusinessOutcome(ApprovalProcess process, Long approverId, String result, String opinion) {
        if (process.getBusinessId() == null) {
            return;
        }
        if ("RETIREMENT".equals(process.getProcessType())) {
            if ("REJECTED".equals(result)) {
                retirementApplicationService.rejectApplication(process.getBusinessId(), approverId, opinion);
            } else if ("APPROVED".equals(process.getStatus())) {
                retirementApplicationService.approveApplication(process.getBusinessId(), approverId);
            }
        } else if ("WORK_ORDER".equals(process.getProcessType())) {
            if ("REJECTED".equals(result)) {
                workOrderService.applyApprovalOutcome(process.getBusinessId(), "REJECTED", opinion);
            } else if ("APPROVED".equals(process.getStatus())) {
                workOrderService.applyApprovalOutcome(process.getBusinessId(), "APPROVED", opinion);
            }
        }
    }
}
