package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.SlaConfig;
import com.ams.entity.WorkOrder;
import com.ams.mapper.SlaConfigMapper;
import com.ams.mapper.WorkOrderMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * SLA 计算与监控服务。
 *
 * <p>职责：
 * <ul>
 *   <li>根据工单优先级查询 SLA 配置并计算截止时间</li>
 *   <li>批量刷新工单 SLA 状态（供定时任务调用）</li>
 *   <li>提供 SLA 配置 CRUD</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SlaService {

    private final SlaConfigMapper slaConfigMapper;
    private final WorkOrderMapper workOrderMapper;

    /**
     * 根据工单优先级计算 SLA 截止时间。
     *
     * <p>以工单创建时间为起点，加上 SLA 配置中的 resolveHours。
     * 若找不到对应优先级的配置，使用 MEDIUM 的默认值（168 小时 = 7 天）。
     *
     * @param priority  工单优先级（LOW/MEDIUM/HIGH/CRITICAL）
     * @param createdAt 工单创建时间（通常为 now()）
     * @return SLA 截止时间
     */
    public LocalDateTime calculateSlaDeadline(String priority, LocalDateTime createdAt) {
        int resolveHours = getResolveHours(priority);
        return createdAt.plusHours(resolveHours);
    }

    /**
     * 根据当前时间和 SLA 截止时间计算 SLA 状态。
     *
     * @param slaDeadline SLA 截止时间
     * @param createdAt   工单创建时间
     * @param priority    工单优先级（用于获取预警比例）
     * @return SLA 状态：NORMAL / WARNING / BREACHED
     */
    public String computeSlaStatus(LocalDateTime slaDeadline, LocalDateTime createdAt, String priority) {
        if (slaDeadline == null || createdAt == null) {
            return "NORMAL";
        }
        LocalDateTime now = LocalDateTime.now();
        if (now.isAfter(slaDeadline)) {
            return "BREACHED";
        }
        BigDecimal warningRatio = getWarningRatio(priority);
        long totalSeconds = ChronoUnit.SECONDS.between(createdAt, slaDeadline);
        long elapsedSeconds = ChronoUnit.SECONDS.between(createdAt, now);
        if (totalSeconds > 0) {
            double ratio = (double) elapsedSeconds / totalSeconds;
            if (ratio >= warningRatio.doubleValue()) {
                return "WARNING";
            }
        }
        return "NORMAL";
    }

    /**
     * 批量刷新所有非终态工单的 SLA 状态。
     *
     * <p>供定时任务 SlaMonitorJob 调用，每小时执行一次。
     * 只更新 sla_status 字段，避免触发全量 update。
     *
     * @return 本次刷新的工单数量
     */
    public int refreshAllSlaStatuses() {
        List<String> activeStatuses = List.of("DRAFT", "PENDING", "APPROVING_LEVEL_1",
                "APPROVING_LEVEL_2", "APPROVED", "EXECUTING");
        LambdaQueryWrapper<WorkOrder> wrapper = new LambdaQueryWrapper<WorkOrder>()
                .in(WorkOrder::getStatus, activeStatuses)
                .isNotNull(WorkOrder::getSlaDeadline);
        List<WorkOrder> activeOrders = workOrderMapper.selectList(wrapper);
        if (activeOrders.isEmpty()) {
            return 0;
        }

        // 按 tenantId 分组批量加载 SLA 配置，避免 N+1 查询
        Map<String, Map<String, SlaConfig>> configCache = activeOrders.stream()
                .map(WorkOrder::getTenantId)
                .distinct()
                .collect(Collectors.toMap(Function.identity(), this::loadConfigMap));

        int updated = 0;
        for (WorkOrder wo : activeOrders) {
            Map<String, SlaConfig> configMap = configCache.getOrDefault(wo.getTenantId(), Map.of());
            SlaConfig config = configMap.get(wo.getPriority());
            double warningRatio = config != null && config.getWarningRatio() != null
                    ? config.getWarningRatio().doubleValue() : 0.80;

            String newStatus = computeStatusWithRatio(wo.getSlaDeadline(), wo.getCreateTime(), warningRatio);
            if (!newStatus.equals(wo.getSlaStatus())) {
                wo.setSlaStatus(newStatus);
                workOrderMapper.updateById(wo);
                updated++;
            }
        }
        return updated;
    }

    /**
     * 查询当前租户的 SLA 配置列表。
     */
    public List<SlaConfig> listConfigs() {
        String tenantId = TenantContext.requireTenantId();
        return slaConfigMapper.selectList(
                new LambdaQueryWrapper<SlaConfig>()
                        .eq(SlaConfig::getTenantId, tenantId)
                        .orderByAsc(SlaConfig::getPriority));
    }

    /**
     * 更新 SLA 配置。
     */
    public SlaConfig updateConfig(Long id, SlaConfig config) {
        SlaConfig existing = slaConfigMapper.selectById(id);
        if (existing == null) {
            throw new com.ams.common.exception.BusinessException("SLA 配置不存在");
        }
        existing.setResponseHours(config.getResponseHours());
        existing.setResolveHours(config.getResolveHours());
        existing.setWarningRatio(config.getWarningRatio());
        existing.setStatus(config.getStatus());
        slaConfigMapper.updateById(existing);
        return existing;
    }

    // ── Private helpers ──────────────────────────────────────────────

    private int getResolveHours(String priority) {
        SlaConfig config = findConfigForPriority(priority);
        return config != null ? config.getResolveHours() : getDefaultResolveHours(priority);
    }

    private java.math.BigDecimal getWarningRatio(String priority) {
        SlaConfig config = findConfigForPriority(priority);
        return config != null && config.getWarningRatio() != null
                ? config.getWarningRatio() : java.math.BigDecimal.valueOf(0.80);
    }

    private SlaConfig findConfigForPriority(String priority) {
        String tenantId = safeGetTenantId();
        LambdaQueryWrapper<SlaConfig> wrapper = new LambdaQueryWrapper<SlaConfig>()
                .eq(SlaConfig::getPriority, priority)
                .eq(SlaConfig::getStatus, 1)
                .orderByDesc(SlaConfig::getId)
                .last("LIMIT 1");
        if (tenantId != null) {
            wrapper.eq(SlaConfig::getTenantId, tenantId);
        }
        SlaConfig config = slaConfigMapper.selectOne(wrapper);
        // 若租户级配置不存在，回退到全局配置（tenant_id='0'）
        if (config == null && tenantId != null && !"0".equals(tenantId)) {
            config = slaConfigMapper.selectOne(
                    new LambdaQueryWrapper<SlaConfig>()
                            .eq(SlaConfig::getTenantId, "0")
                            .eq(SlaConfig::getPriority, priority)
                            .eq(SlaConfig::getStatus, 1)
                            .last("LIMIT 1"));
        }
        return config;
    }

    private Map<String, SlaConfig> loadConfigMap(String tenantId) {
        List<SlaConfig> configs = slaConfigMapper.selectList(
                new LambdaQueryWrapper<SlaConfig>()
                        .eq(SlaConfig::getTenantId, tenantId)
                        .eq(SlaConfig::getStatus, 1));
        // 补充全局配置
        if (configs.isEmpty() && !"0".equals(tenantId)) {
            configs = slaConfigMapper.selectList(
                    new LambdaQueryWrapper<SlaConfig>()
                            .eq(SlaConfig::getTenantId, "0")
                            .eq(SlaConfig::getStatus, 1));
        }
        return configs.stream()
                .collect(Collectors.toMap(SlaConfig::getPriority, Function.identity(), (a, b) -> a));
    }

    private String computeStatusWithRatio(LocalDateTime deadline, LocalDateTime createdAt, double warningRatio) {
        if (deadline == null || createdAt == null) {
            return "NORMAL";
        }
        LocalDateTime now = LocalDateTime.now();
        if (now.isAfter(deadline)) {
            return "BREACHED";
        }
        long totalSeconds = ChronoUnit.SECONDS.between(createdAt, deadline);
        long elapsedSeconds = ChronoUnit.SECONDS.between(createdAt, now);
        if (totalSeconds > 0 && (double) elapsedSeconds / totalSeconds >= warningRatio) {
            return "WARNING";
        }
        return "NORMAL";
    }

    private int getDefaultResolveHours(String priority) {
        return switch (priority != null ? priority : "MEDIUM") {
            case "LOW" -> 336;      // 14 天
            case "HIGH" -> 72;      // 3 天
            case "CRITICAL" -> 24;  // 1 天
            default -> 168;         // 7 天（MEDIUM）
        };
    }

    private String safeGetTenantId() {
        try {
            return TenantContext.requireTenantId();
        } catch (Exception e) {
            return null;
        }
    }
}
