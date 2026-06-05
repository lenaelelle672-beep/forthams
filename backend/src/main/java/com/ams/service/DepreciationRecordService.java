package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.DepreciationRecord;
import com.ams.mapper.DepreciationRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class DepreciationRecordService {

    private final DepreciationRecordMapper depreciationRecordMapper;

    /**
     * 按资产ID分页查询折旧记录
     */
    public Page<DepreciationRecord> getRecordsByAssetId(Long assetId, int page, int size) {
        String tenantId = TenantContext.requireTenantId();
        return depreciationRecordMapper.selectPage(new Page<>(page, size),
                new QueryWrapper<DepreciationRecord>()
                        .eq("tenant_id", tenantId)
                        .eq("asset_id", assetId)
                        .orderByDesc("period_start"));
    }

    /**
     * 按时间段查询折旧记录
     */
    public Page<DepreciationRecord> getRecordsByPeriod(LocalDate periodStart, LocalDate periodEnd,
                                                        int page, int size) {
        String tenantId = TenantContext.requireTenantId();
        return depreciationRecordMapper.selectPage(new Page<>(page, size),
                new QueryWrapper<DepreciationRecord>()
                        .eq("tenant_id", tenantId)
                        .ge("period_start", periodStart)
                        .le("period_end", periodEnd)
                        .orderByDesc("period_start"));
    }

    /**
     * 按资产ID获取最近记录
     */
    public java.util.List<DepreciationRecord> getLatestByAssetId(Long assetId, int limit) {
        String tenantId = TenantContext.requireTenantId();
        return depreciationRecordMapper.selectByAssetId(tenantId, assetId, limit);
    }
}
