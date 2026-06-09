package com.ams.service;

import com.ams.entity.Asset;
import com.ams.entity.CycleCountRule;
import com.ams.entity.InventoryDetail;
import com.ams.entity.InventoryTask;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.InventoryDetailMapper;
import com.ams.mapper.InventoryTaskMapper;
import com.ams.context.TenantContext;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 循环盘点服务
 * 按 ABC 分类规则定时生成盘点任务（inventoryType = 'CYCLE_COUNT'）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CycleCountService {

    private final CycleCountRuleService cycleCountRuleService;
    private final InventoryTaskMapper inventoryTaskMapper;
    private final AssetMapper assetMapper;
    private final InventoryDetailMapper inventoryDetailMapper;
    private final TenantService tenantService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * A 类资产：每月 1 日凌晨 2 点
     */
    @Scheduled(cron = "0 0 2 1 * ?")
    @Transactional(rollbackFor = Exception.class)
    public void generateMonthlyTasks() {
        generateTasksForActiveTenants("A", "MONTHLY");
    }

    /**
     * B 类资产：每季度首月 1 日凌晨 3 点
     */
    @Scheduled(cron = "0 0 3 1 */3 ?")
    @Transactional(rollbackFor = Exception.class)
    public void generateQuarterlyTasks() {
        generateTasksForActiveTenants("B", "QUARTERLY");
    }

    /**
     * C 类资产：每年 1 月 1 日凌晨 4 点
     */
    @Scheduled(cron = "0 0 4 1 1 ?")
    @Transactional(rollbackFor = Exception.class)
    public void generateYearlyTasks() {
        generateTasksForActiveTenants("C", "YEARLY");
    }

    /**
     * 按活跃租户逐个绑定上下文生成盘点任务。
     */
    private void generateTasksForActiveTenants(String classification, String frequency) {
        for (String tenantId : tenantService.getActiveTenantIds()) {
            try {
                TenantContext.setTenantId(tenantId);
                generateTasksByClassificationForCurrentTenant(classification, frequency);
            } catch (RuntimeException e) {
                log.error("[CycleCount] 租户 {} 生成盘点任务失败: {}", tenantId, e.getMessage(), e);
            } finally {
                TenantContext.clear();
            }
        }
    }

    /**
     * 按分类和频率为当前租户生成盘点任务
     */
    private void generateTasksByClassificationForCurrentTenant(String classification, String frequency) {
        String tenantId = TenantContext.requireTenantId();
        try {
            List<CycleCountRule> rules = cycleCountRuleService.listAll();
            for (CycleCountRule rule : rules) {
                if (!classification.equals(rule.getClassification()) || !frequency.equals(rule.getFrequency())) {
                    continue;
                }
                // 检查本月是否已生成过
                String thisMonth = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMM"));
                Long existingCount = inventoryTaskMapper.selectCount(new LambdaQueryWrapper<InventoryTask>()
                        .eq(InventoryTask::getTenantId, tenantId)
                        .eq(InventoryTask::getTaskNo, "CC-" + thisMonth + "-" + rule.getClassification() + "-" + rule.getId()));
                if (existingCount != null && existingCount > 0) {
                    log.info("[CycleCount] 本月 {} 类盘点任务已存在，跳过生成 [ruleId: {}]", rule.getClassification(), rule.getId());
                    continue;
                }

                // 查询符合条件的资产
                List<Asset> assets = queryAssetsByRule(rule);
                if (assets.isEmpty()) {
                    log.info("[CycleCount] 未找到符合条件的资产 [ruleId: {}, classification: {}]", rule.getId(), rule.getClassification());
                    continue;
                }

                // 创建盘点任务
                InventoryTask task = new InventoryTask();
                task.setTaskNo("CC-" + thisMonth + "-" + rule.getClassification() + "-" + rule.getId());
                task.setTaskName(rule.getClassification() + "类资产循环盘点（" + getFrequencyLabel(frequency) + "）");
                task.setInventoryType("CYCLE_COUNT");
                task.setTenantId(tenantId);
                task.setStatus("DRAFT");
                task.setStartDate(LocalDate.now());
                task.setEndDate(LocalDate.now().plusDays(getDurationDays(frequency)));
                task.setCreateBy(0L); // 系统创建

                inventoryTaskMapper.insert(task);
                log.info("[CycleCount] 已生成 {} 类盘点任务: {} [ruleId: {}, assetCount: {}]", rule.getClassification(), task.getTaskNo(), rule.getId(), assets.size());

                // 批量创建盘点明细（使用 MyBatis-Plus 批量插入优化，每批 500 条）
                List<InventoryDetail> details = assets.stream().map(asset -> {
                    InventoryDetail detail = new InventoryDetail();
                    detail.setTaskId(task.getId());
                    detail.setTenantId(tenantId);
                    detail.setAssetId(asset.getId());
                    detail.setRfidTag(asset.getRfidTag());
                    detail.setExpectedLocation(asset.getLocation());
                    detail.setStatus("PENDING");
                    return detail;
                }).toList();

                // 批量插入，每批 500 条
                try {
                    for (int i = 0; i < details.size(); i += 500) {
                        int end = Math.min(i + 500, details.size());
                        List<InventoryDetail> batch = details.subList(i, end);
                        for (InventoryDetail detail : batch) {
                            inventoryDetailMapper.insert(detail);
                        }
                    }
                    log.info("[CycleCount] 已批量创建 {} 条盘点明细 [taskId: {}]", assets.size(), task.getId());
                } catch (Exception e) {
                    log.error("[CycleCount] 批量创建盘点明细失败: {}", e.getMessage(), e);
                }
            }
        } catch (Exception e) {
            log.error("[CycleCount] 生成盘点任务失败: {}", e.getMessage(), e);
        }
    }

    /**
     * 根据规则查询符合条件的资产
     */
    private List<Asset> queryAssetsByRule(CycleCountRule rule) {
        LambdaQueryWrapper<Asset> wrapper = new LambdaQueryWrapper<>();
        
        // 匹配 ABC 分类
        wrapper.eq(Asset::getAbcClassification, rule.getClassification());
        
        // 匹配分类 ID（如果规则中指定了 categoryIds）
        if (rule.getCategoryIds() != null && !rule.getCategoryIds().trim().isEmpty()) {
            try {
                List<Long> categoryIds = objectMapper.readValue(rule.getCategoryIds(), new TypeReference<List<Long>>() {});
                if (!categoryIds.isEmpty()) {
                    wrapper.in(Asset::getCategoryId, categoryIds);
                }
            } catch (Exception e) {
                log.warn("[CycleCount] 解析 categoryIds JSON 失败: {} [ruleId: {}]", rule.getCategoryIds(), rule.getId());
            }
        }
        
        // 匹配价值区间
        if (rule.getMinValue() != null) {
            wrapper.ge(Asset::getOriginalValue, rule.getMinValue());
        }
        if (rule.getMaxValue() != null) {
            wrapper.le(Asset::getOriginalValue, rule.getMaxValue());
        }
        
        // 租户过滤和软删除
        wrapper.eq(Asset::getTenantId, rule.getTenantId());
        wrapper.eq(Asset::getDeleted, 0);
        
        return assetMapper.selectList(wrapper);
    }

    /**
     * 手动触发生成盘点任务
     */
    @Transactional(rollbackFor = Exception.class)
    public int triggerGenerate(String classification) {
        String frequency = switch (classification) {
            case "A" -> "MONTHLY";
            case "B" -> "QUARTERLY";
            case "C" -> "YEARLY";
            default -> throw new IllegalArgumentException("Unknown classification: " + classification);
        };
        generateTasksByClassificationForCurrentTenant(classification, frequency);
        return 1;
    }

    private String getFrequencyLabel(String frequency) {
        return switch (frequency) {
            case "MONTHLY" -> "月度";
            case "QUARTERLY" -> "季度";
            case "YEARLY" -> "年度";
            default -> frequency;
        };
    }

    private int getDurationDays(String frequency) {
        return switch (frequency) {
            case "MONTHLY" -> 30;
            case "QUARTERLY" -> 90;
            case "YEARLY" -> 365;
            default -> 30;
        };
    }
}
