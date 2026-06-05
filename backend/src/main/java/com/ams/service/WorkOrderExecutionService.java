package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.WorkOrderStep;
import com.ams.entity.WorkOrderTimeLog;
import com.ams.mapper.WorkOrderStepMapper;
import com.ams.mapper.WorkOrderTimeLogMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class WorkOrderExecutionService {

    private final WorkOrderTimeLogMapper workOrderTimeLogMapper;
    private final WorkOrderStepMapper workOrderStepMapper;

    // ── 工时登记 ──────────────────────────────────────────────────────────

    public List<WorkOrderTimeLog> getTimeLogs(Long workOrderId) {
        String tenantId = TenantContext.requireTenantId();
        return workOrderTimeLogMapper.selectList(
                new LambdaQueryWrapper<WorkOrderTimeLog>()
                        .eq(WorkOrderTimeLog::getWorkOrderId, workOrderId)
                        .eq(WorkOrderTimeLog::getTenantId, tenantId)
                        .orderByDesc(WorkOrderTimeLog::getStartTime));
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkOrderTimeLog startTimer(Long workOrderId, Long userId, String userName) {
        String tenantId = TenantContext.requireTenantId();
        WorkOrderTimeLog timeLog = new WorkOrderTimeLog();
        timeLog.setWorkOrderId(workOrderId);
        timeLog.setUserId(userId);
        timeLog.setUserName(userName);
        timeLog.setStartTime(LocalDateTime.now());
        timeLog.setTenantId(tenantId);
        workOrderTimeLogMapper.insert(timeLog);
        return timeLog;
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkOrderTimeLog stopTimer(Long timeLogId) {
        String tenantId = TenantContext.requireTenantId();
        WorkOrderTimeLog timeLog = workOrderTimeLogMapper.selectOne(
                new LambdaQueryWrapper<WorkOrderTimeLog>()
                        .eq(WorkOrderTimeLog::getId, timeLogId)
                        .eq(WorkOrderTimeLog::getTenantId, tenantId));
        if (timeLog == null) {
            throw new BusinessException("工时记录不存在");
        }
        if (timeLog.getEndTime() != null) {
            throw new BusinessException("该计时已结束");
        }
        LocalDateTime endTime = LocalDateTime.now();
        timeLog.setEndTime(endTime);
        timeLog.setDurationMinutes((int) ChronoUnit.MINUTES.between(timeLog.getStartTime(), endTime));
        workOrderTimeLogMapper.updateById(timeLog);
        return timeLog;
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkOrderTimeLog logTime(Long workOrderId, Long userId, String userName,
                                     LocalDateTime startTime, LocalDateTime endTime,
                                     String description) {
        String tenantId = TenantContext.requireTenantId();
        WorkOrderTimeLog timeLog = new WorkOrderTimeLog();
        timeLog.setWorkOrderId(workOrderId);
        timeLog.setUserId(userId);
        timeLog.setUserName(userName);
        timeLog.setStartTime(startTime);
        timeLog.setEndTime(endTime);
        timeLog.setDurationMinutes((int) ChronoUnit.MINUTES.between(startTime, endTime));
        timeLog.setDescription(description);
        timeLog.setTenantId(tenantId);
        workOrderTimeLogMapper.insert(timeLog);
        return timeLog;
    }

    // ── 步骤Checklist ─────────────────────────────────────────────────────

    public List<WorkOrderStep> getSteps(Long workOrderId) {
        String tenantId = TenantContext.requireTenantId();
        return workOrderStepMapper.selectList(
                new LambdaQueryWrapper<WorkOrderStep>()
                        .eq(WorkOrderStep::getWorkOrderId, workOrderId)
                        .eq(WorkOrderStep::getTenantId, tenantId)
                        .orderByAsc(WorkOrderStep::getStepOrder));
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkOrderStep createStep(Long workOrderId, String stepName, Integer stepOrder) {
        String tenantId = TenantContext.requireTenantId();
        WorkOrderStep step = new WorkOrderStep();
        step.setWorkOrderId(workOrderId);
        step.setStepName(stepName);
        step.setStepOrder(stepOrder);
        step.setIsCompleted(0);
        step.setTenantId(tenantId);
        workOrderStepMapper.insert(step);
        return step;
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkOrderStep updateStep(Long stepId, String stepName, Integer stepOrder) {
        String tenantId = TenantContext.requireTenantId();
        WorkOrderStep step = workOrderStepMapper.selectOne(
                new LambdaQueryWrapper<WorkOrderStep>()
                        .eq(WorkOrderStep::getId, stepId)
                        .eq(WorkOrderStep::getTenantId, tenantId));
        if (step == null) {
            throw new BusinessException("步骤不存在");
        }
        if (stepName != null) step.setStepName(stepName);
        if (stepOrder != null) step.setStepOrder(stepOrder);
        workOrderStepMapper.updateById(step);
        return step;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteStep(Long stepId) {
        String tenantId = TenantContext.requireTenantId();
        workOrderStepMapper.delete(new LambdaQueryWrapper<WorkOrderStep>()
                .eq(WorkOrderStep::getId, stepId)
                .eq(WorkOrderStep::getTenantId, tenantId));
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkOrderStep completeStep(Long stepId, Long completedBy) {
        String tenantId = TenantContext.requireTenantId();
        WorkOrderStep step = workOrderStepMapper.selectOne(
                new LambdaQueryWrapper<WorkOrderStep>()
                        .eq(WorkOrderStep::getId, stepId)
                        .eq(WorkOrderStep::getTenantId, tenantId));
        if (step == null) {
            throw new BusinessException("步骤不存在");
        }
        step.setIsCompleted(1);
        step.setCompletedBy(completedBy);
        step.setCompletedAt(LocalDateTime.now());
        workOrderStepMapper.updateById(step);
        return step;
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkOrderStep uncompleteStep(Long stepId) {
        String tenantId = TenantContext.requireTenantId();
        WorkOrderStep step = workOrderStepMapper.selectOne(
                new LambdaQueryWrapper<WorkOrderStep>()
                        .eq(WorkOrderStep::getId, stepId)
                        .eq(WorkOrderStep::getTenantId, tenantId));
        if (step == null) {
            throw new BusinessException("步骤不存在");
        }
        step.setIsCompleted(0);
        step.setCompletedBy(null);
        step.setCompletedAt(null);
        workOrderStepMapper.updateById(step);
        return step;
    }

    // ── 进度计算 ──────────────────────────────────────────────────────────

    public Map<String, Object> getProgress(Long workOrderId) {
        String tenantId = TenantContext.requireTenantId();
        List<WorkOrderStep> steps = workOrderStepMapper.selectList(
                new LambdaQueryWrapper<WorkOrderStep>()
                        .eq(WorkOrderStep::getWorkOrderId, workOrderId)
                        .eq(WorkOrderStep::getTenantId, tenantId));

        int total = steps.size();
        long completed = steps.stream().filter(s -> s.getIsCompleted() != null && s.getIsCompleted() == 1).count();
        int percentage = total > 0 ? (int) Math.round((completed * 100.0) / total) : 0;

        // 计算总工时
        List<WorkOrderTimeLog> logs = workOrderTimeLogMapper.selectList(
                new LambdaQueryWrapper<WorkOrderTimeLog>()
                        .eq(WorkOrderTimeLog::getWorkOrderId, workOrderId)
                        .eq(WorkOrderTimeLog::getTenantId, tenantId));
        int totalMinutes = logs.stream()
                .filter(l -> l.getDurationMinutes() != null)
                .mapToInt(WorkOrderTimeLog::getDurationMinutes)
                .sum();

        Map<String, Object> progress = new HashMap<>();
        progress.put("totalSteps", total);
        progress.put("completedSteps", completed);
        progress.put("percentage", percentage);
        progress.put("totalDurationMinutes", totalMinutes);
        return progress;
    }
}
