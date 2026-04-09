package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
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

    public Page<ApprovalProcess> queryProcesses(Integer page, Integer pageSize, String status, String processType) {
        Page<ApprovalProcess> pageParam = new Page<>(page, pageSize);
        QueryWrapper<ApprovalProcess> wrapper = new QueryWrapper<>();

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
        ApprovalProcess process = approvalProcessMapper.selectById(id);
        if (process == null) {
            throw new BusinessException("审批流程不存在");
        }

        List<ApprovalRecord> records = approvalRecordMapper.selectList(
            new QueryWrapper<ApprovalRecord>()
                .eq("process_id", id)
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
        ApprovalProcess process = new ApprovalProcess();
        BeanUtil.copyProperties(dto, process);
        BeanUtil.setProperty(process, "processNo", generateProcessNo());
        BeanUtil.setProperty(process, "status", "PENDING");
        BeanUtil.setProperty(process, "currentStep", 1);
        BeanUtil.setProperty(process, "applyTime", LocalDateTime.now());

        approvalProcessMapper.insert(process);
        return process;
    }

    @Transactional(rollbackFor = Exception.class)
    public ApprovalProcess approve(Long processId, Long approverId, String result, String opinion) {
        ApprovalProcess process = approvalProcessMapper.selectById(processId);
        if (process == null) {
            throw new BusinessException("审批流程不存在");
        }
        if (!"PENDING".equals(BeanUtil.getProperty(process, "status"))) {
            throw new BusinessException("当前流程不可审批");
        }

        ApprovalRecord record = new ApprovalRecord();
        BeanUtil.setProperty(record, "processId", processId);
        Integer currentStep = parseInteger(BeanUtil.getProperty(process, "currentStep"), 1);
        BeanUtil.setProperty(record, "stepNo", currentStep);
        BeanUtil.setProperty(record, "approverId", approverId);
        BeanUtil.setProperty(record, "approveResult", result);
        BeanUtil.setProperty(record, "approveOpinion", opinion);
        BeanUtil.setProperty(record, "approveTime", LocalDateTime.now());
        approvalRecordMapper.insert(record);

        if ("REJECTED".equals(result)) {
            BeanUtil.setProperty(process, "status", "REJECTED");
        } else if ("APPROVED".equals(result)) {
            if (currentStep >= FINAL_STEP) {
                BeanUtil.setProperty(process, "status", "APPROVED");
            } else {
                BeanUtil.setProperty(process, "currentStep", currentStep + 1);
            }
        } else {
            throw new BusinessException("审批结果无效");
        }

        approvalProcessMapper.updateById(process);
        return process;
    }

    public List<ApprovalProcess> getMyPendingApprovals(Long approverId) {
        List<ApprovalProcess> pendingList = approvalProcessMapper.selectList(
            new QueryWrapper<ApprovalProcess>()
                .eq("status", "PENDING")
                .orderByDesc("create_time")
        );

        if (approverId == null || pendingList.isEmpty()) {
            return pendingList;
        }

        List<ApprovalRecord> myRecords = approvalRecordMapper.selectList(
            new QueryWrapper<ApprovalRecord>()
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
        return approvalProcessMapper.selectCount(
            new QueryWrapper<ApprovalProcess>().eq("status", "PENDING")
        );
    }

    private String generateProcessNo() {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "APR-" + dateStr + "-";

        Long count = approvalProcessMapper.selectCount(
            new QueryWrapper<ApprovalProcess>()
                .likeRight("process_no", prefix)
        );
        long sequence = (count == null ? 0 : count) + 1;
        return prefix + String.format("%03d", sequence);
    }

    private Integer parseInteger(String value, Integer defaultValue) {
        if (value == null || value.isEmpty()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
    }

    private Long parseLong(String value, Long defaultValue) {
        if (value == null || value.isEmpty()) {
            return defaultValue;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
    }
}
