package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.WorkOrder;
import com.ams.entity.WorkOrderHoldRecord;
import com.ams.mapper.WorkOrderHoldRecordMapper;
import com.ams.service.TenantService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class WorkOrderHoldService {

    private static final Logger log = LoggerFactory.getLogger(WorkOrderHoldService.class);

    private final WorkOrderHoldRecordMapper workOrderHoldRecordMapper;
    private final WorkOrderService workOrderService;
    private final NotificationService notificationService;
    private final TenantService tenantService;

    /**
     * 挂起工单
     */
    @Transactional(rollbackFor = Exception.class)
    public WorkOrderHoldRecord hold(Long workOrderId, String reason, LocalDateTime holdEndTime) {
        String tenantId = TenantContext.requireTenantId();

        WorkOrder workOrder = workOrderService.getWorkOrder(workOrderId);
        if (!"EXECUTING".equals(workOrder.getStatus())) {
            throw new BusinessException("只有执行中的工单可以挂起");
        }

        // 并发控制：检查是否存在未恢复的挂起记录
        LambdaQueryWrapper<WorkOrderHoldRecord> existingWrapper = new LambdaQueryWrapper<>();
        existingWrapper.eq(WorkOrderHoldRecord::getWorkOrderId, workOrderId)
                .eq(WorkOrderHoldRecord::getTenantId, tenantId)
                .isNull(WorkOrderHoldRecord::getResumedAt)
                .eq(WorkOrderHoldRecord::getDeleted, 0)
                .last("LIMIT 1");
        WorkOrderHoldRecord existingRecord = workOrderHoldRecordMapper.selectOne(existingWrapper);
        if (existingRecord != null) {
            throw new BusinessException("该工单已处于挂起状态，无法重复挂起");
        }

        // 创建挂起记录
        WorkOrderHoldRecord record = new WorkOrderHoldRecord();
        record.setWorkOrderId(workOrderId);
        record.setHoldReason(reason);
        record.setHeldBy(getCurrentUserId());
        record.setHeldAt(LocalDateTime.now());
        record.setHoldEndTime(holdEndTime);
        record.setTenantId(tenantId);
        workOrderHoldRecordMapper.insert(record);

        // 状态流转：EXECUTING → ON_HOLD
        workOrderService.operateWorkOrder(workOrderId, "hold", reason);

        return record;
    }

    /**
     * 恢复工单
     */
    @Transactional(rollbackFor = Exception.class)
    public WorkOrderHoldRecord resume(Long workOrderId, String note) {
        String tenantId = TenantContext.requireTenantId();

        WorkOrder workOrder = workOrderService.getWorkOrder(workOrderId);
        if (!"ON_HOLD".equals(workOrder.getStatus())) {
            throw new BusinessException("只有挂起中的工单可以恢复");
        }

        // 查找当前挂起记录（未恢复的）
        WorkOrderHoldRecord record = workOrderHoldRecordMapper.selectOne(
                new LambdaQueryWrapper<WorkOrderHoldRecord>()
                        .eq(WorkOrderHoldRecord::getWorkOrderId, workOrderId)
                        .eq(WorkOrderHoldRecord::getTenantId, tenantId)
                        .isNull(WorkOrderHoldRecord::getResumedAt)
                        .orderByDesc(WorkOrderHoldRecord::getHeldAt)
                        .last("LIMIT 1"));
        if (record == null) {
            throw new BusinessException("未找到挂起记录");
        }

        record.setResumedAt(LocalDateTime.now());
        record.setResumedBy(getCurrentUserId());
        workOrderHoldRecordMapper.updateById(record);

        // 状态流转：ON_HOLD → EXECUTING
        workOrderService.operateWorkOrder(workOrderId, "resume", note);

        return record;
    }

    /**
     * 每 5 分钟扫描超时挂起的工单，自动恢复
     */
    @Scheduled(cron = "0 */5 * * * *")
    @Transactional(rollbackFor = Exception.class)
    public void scanOverdueHolds() {
        log.info("开始扫描超时挂起工单...");
        LocalDateTime now = LocalDateTime.now();

        // 按租户扫描，确保多租户隔离
        List<String> tenantIds = getActiveTenantIds();
        for (String tenantId : tenantIds) {
            scanTimeoutRecordsForTenant(tenantId, now);
        }

        log.info("超时挂起工单扫描完成");
    }

    /**
     * 获取活跃租户列表
     */
    private List<String> getActiveTenantIds() {
        // 从 TenantService 获取配置化租户 ID 列表（阶段 1 占位实现）
        return tenantService.getActiveTenantIds();
    }

    /**
     * 扫描指定租户的超时记录
     */
    private void scanTimeoutRecordsForTenant(String tenantId, LocalDateTime now) {
        int pageSize = 100;
        int currentPage = 1;
        int totalProcessed = 0;

        while (true) {
            // 使用分页查询，避免一次性加载大量数据
            com.baomidou.mybatisplus.extension.plugins.pagination.Page<WorkOrderHoldRecord> page =
                new com.baomidou.mybatisplus.extension.plugins.pagination.Page<>(currentPage, pageSize);

            LambdaQueryWrapper<WorkOrderHoldRecord> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(WorkOrderHoldRecord::getTenantId, tenantId)
                   .eq(WorkOrderHoldRecord::getDeleted, 0)
                   .isNull(WorkOrderHoldRecord::getResumedAt)
                   .isNotNull(WorkOrderHoldRecord::getHoldEndTime)
                   .lt(WorkOrderHoldRecord::getHoldEndTime, now)
                   .orderByDesc(WorkOrderHoldRecord::getHeldAt);

            com.baomidou.mybatisplus.extension.plugins.pagination.Page<WorkOrderHoldRecord> result =
                workOrderHoldRecordMapper.selectPage(page, wrapper);

            List<WorkOrderHoldRecord> records = result.getRecords();
            if (records.isEmpty()) {
                break;
            }

            // 去重处理：同一工单 5 分钟内只通知一次，使用 lastNotificationTime
            java.util.Set<Long> processedOrderIds = new java.util.HashSet<>();
            for (WorkOrderHoldRecord record : records) {
                if (processedOrderIds.contains(record.getWorkOrderId())) {
                    continue;
                }

                // 去重：若 5 分钟内已发送通知，跳过
                if (record.getLastNotificationTime() != null) {
                    LocalDateTime fiveMinutesAgo = now.minusMinutes(5);
                    if (record.getLastNotificationTime().isAfter(fiveMinutesAgo)) {
                        log.info("工单 {} 最近 5 分钟已发送通知，跳过本次", record.getWorkOrderId());
                        continue;
                    }
                }

                processedOrderIds.add(record.getWorkOrderId());

                try {
                    // 发送提醒通知（不自动恢复）
                    WorkOrder workOrder = workOrderService.getWorkOrder(record.getWorkOrderId());
                    if (workOrder != null && tenantId.equals(workOrder.getTenantId())) {
                        sendOverdueHoldNotification(workOrder, record);

                        // 更新 lastNotificationTime，避免 5 分钟内重复通知
                        WorkOrderHoldRecord updateRecord = new WorkOrderHoldRecord();
                        updateRecord.setId(record.getId());
                        updateRecord.setLastNotificationTime(now);
                        workOrderHoldRecordMapper.updateById(updateRecord);

                        totalProcessed++;
                        log.info("已发送挂起超时提醒: workOrderId={}, holdId={}", record.getWorkOrderId(), record.getId());
                    }
                } catch (Exception e) {
                    log.error("发送挂起超时提醒失败: workOrderId={}, tenantId={}, error={}",
                        record.getWorkOrderId(), tenantId, e.getMessage());
                }
            }

            currentPage++;
        }

        if (totalProcessed > 0) {
            log.info("租户 {} 扫描完成，共处理 {} 条超时记录", tenantId, totalProcessed);
        }
    }

    /**
     * 获取当前用户ID
     */
    private Long getCurrentUserId() {
        // 从 Spring Security SecurityContext 获取当前用户ID
        // 如果获取失败，返回 0L 作为兜底
        try {
            org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
                String username = auth.getName();
                // TODO: 通过 UserMapper 反查 ID，这里简化处理
                return 0L;
            }
        } catch (Exception e) {
            log.warn("获取当前用户ID失败: {}", e.getMessage());
        }
        return 0L;
    }

    /**
     * 发送挂起超时提醒通知
     */
    private void sendOverdueHoldNotification(WorkOrder workOrder, WorkOrderHoldRecord record) {
        if (workOrder.getAssigneeId() == null) {
            return;
        }

        com.ams.entity.NotificationRecord notification = new com.ams.entity.NotificationRecord();
        notification.setUserId(workOrder.getAssigneeId());
        notification.setTitle("工单挂起超时提醒");
        notification.setContent(String.format(
                "工单「%s」已挂起超过预计恢复时间（%s），请尽快恢复处理。",
                workOrder.getTitle() != null ? workOrder.getTitle() : workOrder.getWorkOrderNo(),
                record.getHoldEndTime() != null ? record.getHoldEndTime().toString() : "未设定"
        ));
        notification.setType("WORK_ORDER");
        notification.setCategory("ALERT");
        notification.setRefId(workOrder.getId());
        notification.setRefType("WORK_ORDER");
        notificationService.create(notification);
    }
}