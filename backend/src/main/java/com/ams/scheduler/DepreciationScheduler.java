package com.ams.scheduler;

import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.mapper.AssetMapper;
import com.ams.service.DepreciationService;
import com.ams.service.TenantService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

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
    private final TenantService tenantService;

    /**
     * 每天凌晨 2:00 执行批量折旧计算。
     * cron: 秒 分 时 日 月 星期
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void runDailyDepreciation() {
        log.info("depreciation_scheduler_start");
        int totalProcessed = 0;
        try {
            for (String tenantId : tenantService.getActiveTenantIds()) {
                try {
                    TenantContext.setTenantId(tenantId);
                    List<Asset> activeAssets = assetMapper.selectList(new QueryWrapper<Asset>()
                            .eq("tenant_id", tenantId)
                            .eq("status", "IN_USE"));

                    if (activeAssets == null || activeAssets.isEmpty()) {
                        log.info("depreciation_scheduler_tenant_no_assets tenant={}", tenantId);
                        continue;
                    }

                    List<Long> assetIds = activeAssets.stream()
                            .map(Asset::getId)
                            .toList();
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
