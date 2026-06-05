package com.ams.service.impl;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.InspectionTask;
import com.ams.mapper.InspectionTaskMapper;
import com.ams.service.InspectionTaskService;
import com.ams.service.TenantService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

/**
 * 检验任务服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InspectionTaskServiceImpl implements InspectionTaskService {
    private final InspectionTaskMapper taskMapper;
    private final TenantService tenantService;

    @Override
    public Page<InspectionTask> listTasks(String keyword, String status, String taskType,
                                           LocalDate startDate, LocalDate endDate,
                                           Integer pageNum, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<InspectionTask> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<InspectionTask> wrapper = new LambdaQueryWrapper<InspectionTask>()
                .eq(InspectionTask::getTenantId, tenantId);

        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(InspectionTask::getTaskNo, keyword)
                    .or().like(InspectionTask::getTaskName, keyword));
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(InspectionTask::getStatus, status);
        }
        if (taskType != null && !taskType.isEmpty()) {
            wrapper.eq(InspectionTask::getTaskType, taskType);
        }
        if (startDate != null) {
            wrapper.ge(InspectionTask::getPlannedDate, startDate);
        }
        if (endDate != null) {
            wrapper.le(InspectionTask::getPlannedDate, endDate);
        }
        wrapper.orderByDesc(InspectionTask::getCreateTime);
        return taskMapper.selectPage(page, wrapper);
    }

    @Override
    public InspectionTask getTaskById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return taskMapper.selectOne(new LambdaQueryWrapper<InspectionTask>()
                .eq(InspectionTask::getId, id)
                .eq(InspectionTask::getTenantId, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InspectionTask createTask(InspectionTask task) {
        String tenantId = TenantContext.requireTenantId();
        task.setTenantId(tenantId);
        task.setTaskNo(generateTaskNo());
        task.setStatus("PENDING"); // 默认待处理
        taskMapper.insert(task);
        log.info("创建检验任务成功: taskNo={}", task.getTaskNo());
        return task;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InspectionTask updateTask(Long id, InspectionTask task) {
        String tenantId = TenantContext.requireTenantId();
        InspectionTask existing = getTaskById(id);
        if (existing == null) {
            throw new BusinessException("检验任务不存在: id=" + id);
        }
        task.setId(id);
        task.setTenantId(tenantId);
        taskMapper.updateById(task);
        return getTaskById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteTask(Long id) {
        String tenantId = TenantContext.requireTenantId();
        InspectionTask existing = getTaskById(id);
        if (existing == null) {
            throw new BusinessException("检验任务不存在: id=" + id);
        }
        taskMapper.deleteById(id);
        log.info("删除检验任务成功: id={}", id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<InspectionTask> batchCreateTasks(List<InspectionTask> tasks) {
        String tenantId = TenantContext.requireTenantId();
        if (tasks == null || tasks.isEmpty()) {
            throw new BusinessException("任务列表不能为空");
        }

        List<InspectionTask> createdTasks = new java.util.ArrayList<>();
        for (InspectionTask task : tasks) {
            task.setTenantId(tenantId);
            task.setTaskNo(generateTaskNo());
            task.setStatus("PENDING");
            taskMapper.insert(task);
            createdTasks.add(task);
        }

        log.info("批量创建检验任务成功: 共创建 {} 条记录", createdTasks.size());
        return createdTasks;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateTaskStatus(Long id, String status) {
        String tenantId = TenantContext.requireTenantId();
        InspectionTask task = getTaskById(id);
        if (task == null) {
            throw new BusinessException("检验任务不存在: id=" + id);
        }
        task.setStatus(status);
        taskMapper.updateById(task);
        log.info("更新任务状态成功: id={}, status={}", id, status);
    }

    @Override
    public List<InspectionTask> getTasksByStatus(String status) {
        String tenantId = TenantContext.requireTenantId();
        return taskMapper.selectList(
                new LambdaQueryWrapper<InspectionTask>()
                        .eq(InspectionTask::getTenantId, tenantId)
                        .eq(InspectionTask::getStatus, status)
                        .orderByAsc(InspectionTask::getPlannedDate)
        );
    }

    @Override
    public List<InspectionTask> getExpiringTasks(int days) {
        String tenantId = TenantContext.requireTenantId();
        return taskMapper.findExpiringTasks(tenantId, days);
    }

    @Override
    public List<InspectionTask> getOverdueTasks() {
        String tenantId = TenantContext.requireTenantId();
        return taskMapper.findOverdueTasks(tenantId);
    }

    @Override
    public List<InspectionTask> getTasksByTemplate(Long templateId) {
        String tenantId = TenantContext.requireTenantId();
        return taskMapper.findTasksByTemplate(templateId, tenantId);
    }

    // ==================== 定时任务方法 ====================

    /**
     * 定时任务：每天早上 7 点检查即将到期任务（提前 30 天提醒）
     */
    @Scheduled(cron = "0 0 7 * * ?")
    @Transactional(rollbackFor = Exception.class)
    public void remindExpiringTasks() {
        log.info("开始执行即将到期任务提醒任务");
        List<String> tenantIds = getActiveTenantIds();
        for (String tenantId : tenantIds) {
            try {
                checkExpiringForTenant(tenantId);
            } catch (RuntimeException e) {
                log.error("租户 {} 到期检查失败: {}", tenantId, e.getMessage(), e);
            }
        }
        log.info("即将到期任务提醒任务完成");
    }

    /**
     * 定时任务：每天早上 8 点标记逾期任务
     */
    @Scheduled(cron = "0 0 8 * * ?")
    @Transactional(rollbackFor = Exception.class)
    public void markOverdueTasks() {
        log.info("开始执行逾期任务标记任务");
        List<String> tenantIds = getActiveTenantIds();
        for (String tenantId : tenantIds) {
            try {
                markOverdueForTenant(tenantId);
            } catch (RuntimeException e) {
                log.error("租户 {} 逾期标记失败: {}", tenantId, e.getMessage(), e);
            }
        }
        log.info("逾期任务标记任务完成");
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 生成任务编号
     */
    private String generateTaskNo() {
        return "TSK-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-"
                + System.currentTimeMillis() % 10000;
    }

    /**
     * 为指定租户检查即将到期的任务
     */
    private void checkExpiringForTenant(String tenantId) {
        List<InspectionTask> expiring = taskMapper.findExpiringTasks(tenantId, 30);

        for (InspectionTask task : expiring) {
            int daysRemaining = (int) java.time.temporal.ChronoUnit.DAYS.between(
                    LocalDate.now(), task.getPlannedDate());

            if (daysRemaining <= 0 || daysRemaining > 30) continue;

            // TODO: 发送通知
            log.info("发送任务到期提醒: taskNo={}, taskName={}, daysRemaining={}",
                    task.getTaskNo(), task.getTaskName(), daysRemaining);
        }
    }

    /**
     * 为指定租户标记逾期任务
     */
    private void markOverdueForTenant(String tenantId) {
        List<InspectionTask> overdue = taskMapper.findOverdueTasks(tenantId);

        int overdueCount = 0;
        for (InspectionTask task : overdue) {
            task.setStatus("OVERDUE");
            taskMapper.updateById(task);
            overdueCount++;

            log.info("标记逾期任务: taskNo={}, taskName={}", task.getTaskNo(), task.getTaskName());
        }

        if (overdueCount > 0) {
            log.info("租户 {} 标记 {} 个逾期任务", tenantId, overdueCount);
        }
    }

    /**
     * 获取活跃租户列表
     */
    private List<String> getActiveTenantIds() {
        // 从 TenantService 获取配置化租户 ID 列表（阶段 1 占位实现）
        return tenantService.getActiveTenantIds();
    }
}