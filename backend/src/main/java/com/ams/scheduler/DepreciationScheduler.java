package com.ams.scheduler;

import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.mapper.AssetMapper;
import com.ams.service.DepreciationService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 折旧自动计算定时任务
 *
 * <p>每天凌晨 2:00 执行，查询所有在用（IN_USE）资产，
 * 按租户分组后逐一触发月度折旧计算。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DepreciationScheduler {

    private final AssetMapper assetMapper;
    private final DepreciationService depreciationService;

    /**
     * 每天凌晨 2:00 执行批量折旧计算。
     * cron: 秒 分 时 日 月 星期
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void runDailyDepreciation() {
        log.info("depreciation_scheduler_start");
        try {
            // 查询所有 IN_USE 状态的资产（不限租户）
            List<Asset> activeAssets = assetMapper.selectList(
                    new QueryWrapper<Asset>().eq("status", "IN_USE"));

            if (activeAssets == null || activeAssets.isEmpty()) {
                log.info("depreciation_scheduler_no_assets");
                return;
            }

            // 按 tenantId 分组
            Map<String, List<Asset>> byTenant = activeAssets.stream()
                    .filter(a -> a.getTenantId() != null)
                    .collect(Collectors.groupingBy(Asset::getTenantId));

            int totalProcessed = 0;
            for (Map.Entry<String, List<Asset>> entry : byTenant.entrySet()) {
                String tenantId = entry.getKey();
                List<Long> assetIds = entry.getValue().stream()
                        .map(Asset::getId)
                        .collect(Collectors.toList());
                try {
                    TenantContext.setTenantId(tenantId);
                    DepreciationService.BatchCalculateResponse result =
                            depreciationService.calculate(assetIds);
                    totalProcessed += result.processedCount();
                    log.info("depreciation_scheduler_tenant_done tenant={} processed={}",
                            tenantId, result.processedCount());
                } catch (Exception e) {
                    log.error("depreciation_scheduler_tenant_error tenant={} error={}",
                            tenantId, e.getMessage(), e);
                } finally {
                    TenantContext.remove();
                }
            }
            log.info("depreciation_scheduler_done total_processed={}", totalProcessed);
        } catch (Exception e) {
            log.error("depreciation_scheduler_fatal error={}", e.getMessage(), e);
        }
    }
}
