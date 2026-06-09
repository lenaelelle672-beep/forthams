package com.ams.scheduler;

import com.ams.context.TenantContext;
import com.ams.service.NotificationService;
import com.ams.service.SlaService;
import com.ams.service.TenantService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.ams.entity.WorkOrder;
import com.ams.mapper.WorkOrderMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * SLA 监控定时任务。
 *
 * <p>每小时扫描所有非终态工单，刷新 SLA 状态（NORMAL/WARNING/BREACHED）。
 * 对刚进入 WARNING 或 BREACHED 状态的工单发送通知。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SlaMonitorJob {

    private final SlaService slaService;
    private final WorkOrderMapper workOrderMapper;
    private final NotificationService notificationService;
    private final TenantService tenantService;

    /**
     * 每小时整点执行 SLA 状态刷新。
     */
    @Scheduled(cron = "0 0 * * * ?")
    public void refreshSlaStatuses() {
        log.info("sla_monitor_start");
        int totalUpdated = 0;
        int totalNewBreached = 0;
        for (String tenantId : tenantService.getActiveTenantIds()) {
            try {
                TenantContext.setTenantId(tenantId);
                SlaRefreshResult result = refreshSlaStatusesForCurrentTenant();
                totalUpdated += result.updated();
                totalNewBreached += result.newBreached();
            } catch (Exception e) {
                log.error("sla_monitor_tenant_failed tenantId={} error={}", tenantId, e.getMessage(), e);
            } finally {
                TenantContext.clear();
            }
        }
        log.info("sla_monitor_done updated={} new_breached={}", totalUpdated, totalNewBreached);
    }

    private SlaRefreshResult refreshSlaStatusesForCurrentTenant() {
            // 先捕获刷新前的 BREACHED 集合，用于判断"新增"违约
            List<String> preBreachedIds = getBreachedWorkOrderIds();

            int updated = slaService.refreshAllSlaStatuses();

            // 刷新后查询新增的 BREACHED 工单并发送通知
            List<String> postBreachedIds = getBreachedWorkOrderIds();
            int newBreached = 0;
            for (String id : postBreachedIds) {
                if (!preBreachedIds.contains(id)) {
                    sendSlaBreachNotification(Long.parseLong(id));
                    newBreached++;
                }
            }

            return new SlaRefreshResult(updated, newBreached);
    }

    private List<String> getBreachedWorkOrderIds() {
        QueryWrapper<WorkOrder> wrapper = new QueryWrapper<WorkOrder>()
                .select("id")
                .eq("sla_status", "BREACHED")
                .in("status", List.of("PENDING", "APPROVING_LEVEL_1",
                        "APPROVING_LEVEL_2", "APPROVED", "EXECUTING"));
        return workOrderMapper.selectList(wrapper).stream()
                .map(wo -> String.valueOf(wo.getId()))
                .toList();
    }

    private void sendSlaBreachNotification(Long workOrderId) {
        try {
            WorkOrder wo = workOrderMapper.selectById(workOrderId);
            if (wo == null || wo.getReporterId() == null) {
                return;
            }
            long overdueMinutes = wo.getSlaDeadline() != null
                    ? ChronoUnit.MINUTES.between(wo.getSlaDeadline(), LocalDateTime.now()) : 0;

            com.ams.entity.NotificationRecord notification = new com.ams.entity.NotificationRecord();
            notification.setUserId(wo.getReporterId());
            notification.setTitle("SLA 超时告警");
            notification.setContent(String.format(
                    "工单「%s」已超出 SLA 时限 %d 分钟，请尽快处理。",
                    wo.getTitle() != null ? wo.getTitle() : wo.getWorkOrderNo(),
                    overdueMinutes));
            notification.setType("WORK_ORDER");
            notification.setCategory("ALERT");
            notification.setRefId(wo.getId());
            notification.setRefType("WORK_ORDER");
            notificationService.create(notification);
        } catch (Exception e) {
            log.warn("sla_breach_notification_failed workOrderId={} error={}", workOrderId, e.getMessage());
        }
    }

    private record SlaRefreshResult(int updated, int newBreached) {
    }
}
