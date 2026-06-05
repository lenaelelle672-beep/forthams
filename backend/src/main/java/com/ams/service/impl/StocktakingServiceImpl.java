package com.ams.service.impl;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.entity.StocktakingCycle;
import com.ams.entity.StocktakingTask;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.StocktakingCycleMapper;
import com.ams.mapper.StocktakingTaskMapper;
import com.ams.service.StocktakingService;
import com.ams.service.TenantService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class StocktakingServiceImpl implements StocktakingService {

    private final StocktakingCycleMapper cycleMapper;
    private final StocktakingTaskMapper taskMapper;
    private final AssetMapper assetMapper;
    private final TenantService tenantService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void startCycle(StocktakingCycle cycle) {
        String tenantId = TenantContext.requireTenantId();
        cycle.setTenantId(tenantId);
        cycle.setStatus("PLANNED");
        cycle.setCreatorId(getCurrentUserId());
        cycleMapper.insert(cycle);
        log.info("创建盘点周期: cycleId={}, cycleName={}", cycle.getId(), cycle.getCycleName());
    }

    private Long getCurrentUserId() {
        try {
            org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
                return (long) auth.getName().hashCode();
            }
        } catch (RuntimeException e) {
            log.warn("获取当前用户ID失败，返回默认值 0", e);
        }
        return 0L;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void assignTasks(Long cycleId, String abcFilter, String strategy) {
        String tenantId = TenantContext.requireTenantId();
        StocktakingCycle cycle = cycleMapper.selectById(cycleId);
        if (cycle == null) {
            throw new BusinessException("盘点周期不存在");
        }
        if (!"PLANNED".equals(cycle.getStatus())) {
            throw new BusinessException("只能为已计划状态的周期分配任务");
        }

        // 组合策略：先按 ABC 分类筛选，组内再按 location 分组
        LambdaQueryWrapper<Asset> wrapper = new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId);

        if (abcFilter != null && !abcFilter.isEmpty()) {
            wrapper.eq(Asset::getAbcClassification, abcFilter);
        }

        // 按 ABC 分类、location、资产编号排序
        wrapper.orderByAsc(Asset::getAbcClassification)
               .orderByAsc(Asset::getLocationId)
               .orderByAsc(Asset::getAssetNo);

        List<Asset> assets = assetMapper.selectList(wrapper);

        if (assets.isEmpty()) {
            throw new BusinessException("没有符合条件的资产可供盘点");
        }

        // 批量创建盘点任务
        for (Asset asset : assets) {
            StocktakingTask task = new StocktakingTask();
            task.setCycleId(cycleId);
            task.setAssetId(asset.getId());
            task.setLocationId(asset.getLocationId());
            task.setExpectedQuantity(getAssetQuantity(asset));
            task.setActualQuantity(0);
            task.setVariance(0);
            task.setStatus("PENDING");
            task.setTenantId(tenantId);
            taskMapper.insert(task);
        }

        // 更新周期状态为进行中
        cycle.setStatus("IN_PROGRESS");
        cycle.setStartDate(LocalDateTime.now());
        cycleMapper.updateById(cycle);

        log.info("分配盘点任务: cycleId={}, taskCount={}", cycleId, assets.size());
    }

    private Integer getAssetQuantity(Asset asset) {
        // 如果 Asset 有 quantity 字段，使用它；否则默认为 1
        return 1;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void pauseCycle(Long cycleId) {
        String tenantId = TenantContext.requireTenantId();
        StocktakingCycle cycle = cycleMapper.selectById(cycleId);
        if (cycle == null) {
            throw new BusinessException("盘点周期不存在");
        }
        if (!"IN_PROGRESS".equals(cycle.getStatus())) {
            throw new BusinessException("只能暂停进行中的周期");
        }
        cycle.setStatus("PAUSED");
        cycleMapper.updateById(cycle);
        log.info("暂停盘点周期: cycleId={}", cycleId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void resumeCycle(Long cycleId) {
        String tenantId = TenantContext.requireTenantId();
        StocktakingCycle cycle = cycleMapper.selectById(cycleId);
        if (cycle == null) {
            throw new BusinessException("盘点周期不存在");
        }
        if (!"PAUSED".equals(cycle.getStatus())) {
            throw new BusinessException("只能恢复已暂停的周期");
        }
        cycle.setStatus("IN_PROGRESS");
        cycleMapper.updateById(cycle);
        log.info("恢复盘点周期: cycleId={}", cycleId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void completeCycle(Long cycleId) {
        String tenantId = TenantContext.requireTenantId();
        StocktakingCycle cycle = cycleMapper.selectById(cycleId);
        if (cycle == null) {
            throw new BusinessException("盘点周期不存在");
        }
        if (!"IN_PROGRESS".equals(cycle.getStatus())) {
            throw new BusinessException("只能完成进行中的周期");
        }

        // 检查是否所有任务都已盘点
        long pendingCount = taskMapper.selectCount(
                new LambdaQueryWrapper<StocktakingTask>()
                        .eq(StocktakingTask::getCycleId, cycleId)
                        .eq(StocktakingTask::getTenantId, tenantId)
                        .eq(StocktakingTask::getStatus, "PENDING")
        );

        if (pendingCount > 0) {
            throw new BusinessException("还有 " + pendingCount + " 个任务未完成盘点，无法完成周期");
        }

        cycle.setStatus("COMPLETED");
        cycle.setEndDate(LocalDateTime.now());
        cycleMapper.updateById(cycle);
        log.info("完成盘点周期: cycleId={}", cycleId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void adjustVariance(Long taskId, Integer threshold) {
        String tenantId = TenantContext.requireTenantId();
        StocktakingTask task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new BusinessException("盘点任务不存在");
        }
        if (!"COUNTED".equals(task.getStatus())) {
            throw new BusinessException("只能调整已盘点状态的任务");
        }

        // 阈值策略：小额自动调整，大额需要审批
        // 这里简化为直接调整，实际应用中可以添加审批逻辑
        Asset asset = assetMapper.selectById(task.getAssetId());
        if (asset == null) {
            throw new BusinessException("资产不存在");
        }

        // 计算差异值
        int variance = task.getActualQuantity() - task.getExpectedQuantity();

        // 阈值检查（使用当前价值作为判断依据）
        if (threshold == null) {
            threshold = 1000; // 默认阈值
        }

        if (Math.abs(variance * asset.getCurrentValue().doubleValue()) > threshold) {
            // 大额差异，记录日志（实际应用中需要审批流程）
            log.warn("大额差异调整: taskId={}, variance={}, threshold={}", taskId, variance, threshold);
        }

        // 更新资产数量（简化逻辑，实际应用中可能需要更复杂的处理）
        // 这里仅更新任务状态
        task.setStatus("ADJUSTED");
        task.setVariance(variance);
        taskMapper.updateById(task);

        log.info("调整盘点差异: taskId={}, variance={}", taskId, variance);
    }

    @Override
    public List<StocktakingTask> getTasksByCycleId(Long cycleId) {
        String tenantId = TenantContext.requireTenantId();
        return taskMapper.selectList(
                new LambdaQueryWrapper<StocktakingTask>()
                        .eq(StocktakingTask::getCycleId, cycleId)
                        .eq(StocktakingTask::getTenantId, tenantId)
        );
    }

    @Override
    public StocktakingTask getTaskById(Long taskId) {
        String tenantId = TenantContext.requireTenantId();
        StocktakingTask task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new BusinessException("盘点任务不存在");
        }
        if (!task.getTenantId().equals(tenantId)) {
            throw new BusinessException("无权访问该任务");
        }
        return task;
    }

    /**
     * 定时任务 1：每天凌晨 2 点生成盘点任务
     * 查找所有启用的盘点周期规则，为符合条件资产创建盘点任务
     */
    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional(rollbackFor = Exception.class)
    public void generateScheduledTasks() {
        log.info("开始执行定时盘点任务生成...");
        LocalDateTime now = LocalDateTime.now();

        // 获取所有活跃租户
        List<String> tenantIds = getActiveTenantIds();
        for (String tenantId : tenantIds) {
            try {
                generateTasksForTenant(tenantId, now);
            } catch (RuntimeException e) {
                log.error("租户 {} 定时任务生成失败: {}", tenantId, e.getMessage(), e);
            }
        }

        log.info("定时盘点任务生成完成");
    }

    /**
     * 定时任务 2：每小时检查逾期盘点任务
     * 查找超过预期完成时间的任务，标记为逾期并发送通知
     */
    @Scheduled(cron = "0 0 * * * ?")
    @Transactional(rollbackFor = Exception.class)
    public void checkOverdueTasks() {
        log.info("开始检查逾期盘点任务...");
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime overdueThreshold = now.minusHours(24); // 24小时未完成视为逾期

        // 获取所有活跃租户
        List<String> tenantIds = getActiveTenantIds();
        for (String tenantId : tenantIds) {
            try {
                checkOverdueTasksForTenant(tenantId, overdueThreshold, now);
            } catch (RuntimeException e) {
                log.error("租户 {} 逾期检查失败: {}", tenantId, e.getMessage(), e);
            }
        }

        log.info("逾期盘点任务检查完成");
    }

    /**
     * 定时任务 3：每天凌晨 3 点统计盘点完成率
     * 计算进行中周期的任务完成情况并更新统计信息
     */
    @Scheduled(cron = "0 0 3 * * ?")
    @Transactional(rollbackFor = Exception.class)
    public void calculateCompletionRate() {
        log.info("开始统计盘点完成率...");
        LocalDateTime now = LocalDateTime.now();

        // 获取所有活跃租户
        List<String> tenantIds = getActiveTenantIds();
        for (String tenantId : tenantIds) {
            try {
                calculateCompletionRateForTenant(tenantId, now);
            } catch (RuntimeException e) {
                log.error("租户 {} 完成率统计失败: {}", tenantId, e.getMessage(), e);
            }
        }

        log.info("盘点完成率统计完成");
    }

    /**
     * 获取活跃租户列表
     */
    private List<String> getActiveTenantIds() {
        // 从 TenantService 获取配置化租户 ID 列表（阶段 1 占位实现）
        return tenantService.getActiveTenantIds();
    }

    /**
     * 为指定租户生成盘点任务
     */
    private void generateTasksForTenant(String tenantId, LocalDateTime now) {
        // 查找所有进行中的盘点周期
        List<StocktakingCycle> cycles = cycleMapper.selectList(
                new LambdaQueryWrapper<StocktakingCycle>()
                        .eq(StocktakingCycle::getTenantId, tenantId)
                        .eq(StocktakingCycle::getStatus, "IN_PROGRESS")
        );

        if (cycles.isEmpty()) {
            log.debug("租户 {} 无进行中的盘点周期", tenantId);
            return;
        }

        int totalTasksGenerated = 0;
        for (StocktakingCycle cycle : cycles) {
            // 检查是否已经生成过任务
            long existingTaskCount = taskMapper.selectCount(
                    new LambdaQueryWrapper<StocktakingTask>()
                            .eq(StocktakingTask::getCycleId, cycle.getId())
                            .eq(StocktakingTask::getTenantId, tenantId)
            );

            if (existingTaskCount > 0) {
                log.debug("周期 {} 已存在任务，跳过生成", cycle.getId());
                continue;
            }

            // 为周期生成任务
            try {
                assignTasks(cycle.getId(), null, "ALL");
                long taskCount = taskMapper.selectCount(
                        new LambdaQueryWrapper<StocktakingTask>()
                                .eq(StocktakingTask::getCycleId, cycle.getId())
                                .eq(StocktakingTask::getTenantId, tenantId)
                ).longValue();
                totalTasksGenerated += taskCount;
                log.info("租户 {} 周期 {} 自动生成 {} 个盘点任务", tenantId, cycle.getId(), taskCount);
            } catch (RuntimeException e) {
                log.error("租户 {} 周期 {} 任务生成失败", tenantId, cycle.getId(), e);
            }
        }

        if (totalTasksGenerated > 0) {
            log.info("租户 {} 共生成 {} 个盘点任务", tenantId, totalTasksGenerated);
        }
    }

    /**
     * 检查指定租户的逾期任务
     */
    private void checkOverdueTasksForTenant(String tenantId, LocalDateTime overdueThreshold, LocalDateTime now) {
        int pageSize = 100;
        int currentPage = 1;
        int totalOverdue = 0;

        while (true) {
            // 分页查询进行中的任务
            com.baomidou.mybatisplus.extension.plugins.pagination.Page<StocktakingTask> page =
                    new com.baomidou.mybatisplus.extension.plugins.pagination.Page<>(currentPage, pageSize);

            LambdaQueryWrapper<StocktakingTask> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(StocktakingTask::getTenantId, tenantId)
                    .in(StocktakingTask::getStatus, "PENDING", "ASSIGNED")
                    .lt(StocktakingTask::getCreateTime, overdueThreshold)
                    .orderByAsc(StocktakingTask::getCreateTime);

            com.baomidou.mybatisplus.extension.plugins.pagination.Page<StocktakingTask> result =
                    taskMapper.selectPage(page, wrapper);

            List<StocktakingTask> tasks = result.getRecords();
            if (tasks.isEmpty()) {
                break;
            }

            for (StocktakingTask task : tasks) {
                // 获取周期信息
                StocktakingCycle cycle = cycleMapper.selectById(task.getCycleId());
                if (cycle == null || !"IN_PROGRESS".equals(cycle.getStatus())) {
                    continue;
                }

                // 标记任务为逾期
                task.setStatus("OVERDUE");
                taskMapper.updateById(task);
                totalOverdue++;

                log.warn("任务逾期: taskId={}, cycleId={}, assetId={}, createTime={}",
                        task.getId(), task.getCycleId(), task.getAssetId(), task.getCreateTime());

                // TODO: 发送逾期通知（需要 NotificationService）
            }

            currentPage++;
        }

        if (totalOverdue > 0) {
            log.info("租户 {} 发现 {} 个逾期任务", tenantId, totalOverdue);
        }
    }

    /**
     * 计算指定租户的完成率
     */
    private void calculateCompletionRateForTenant(String tenantId, LocalDateTime now) {
        // 查找所有进行中的周期
        List<StocktakingCycle> cycles = cycleMapper.selectList(
                new LambdaQueryWrapper<StocktakingCycle>()
                        .eq(StocktakingCycle::getTenantId, tenantId)
                        .eq(StocktakingCycle::getStatus, "IN_PROGRESS")
        );

        if (cycles.isEmpty()) {
            log.debug("租户 {} 无进行中的盘点周期", tenantId);
            return;
        }

        for (StocktakingCycle cycle : cycles) {
            // 统计任务数量
            long totalCount = taskMapper.selectCount(
                    new LambdaQueryWrapper<StocktakingTask>()
                            .eq(StocktakingTask::getCycleId, cycle.getId())
                            .eq(StocktakingTask::getTenantId, tenantId)
            );

            long completedCount = taskMapper.selectCount(
                    new LambdaQueryWrapper<StocktakingTask>()
                            .eq(StocktakingTask::getCycleId, cycle.getId())
                            .eq(StocktakingTask::getTenantId, tenantId)
                            .in(StocktakingTask::getStatus, "COUNTED", "ADJUSTED", "COMPLETED")
            );

            if (totalCount == 0) {
                log.debug("周期 {} 无任务", cycle.getId());
                continue;
            }

            double completionRate = (double) completedCount / totalCount * 100.0;

            log.info("租户 {} 周期 {} 完成率统计: 总任务={}, 已完成={}, 完成率={}%",
                    tenantId, cycle.getId(), totalCount, completedCount, String.format("%.2f", completionRate));

            // TODO: 可以在这里更新周期的完成率字段（如果需要的话）
        }
    }
}