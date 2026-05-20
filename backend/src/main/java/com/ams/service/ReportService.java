package com.ams.service;

import com.ams.dto.CategoryReportDTO;
import com.ams.dto.ReportSummaryDTO;
import com.ams.entity.Asset;
import com.ams.mapper.AssetMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 资产报表服务
 *
 * <p>提供资产汇总统计和分类统计查询能力。
 * 当 AssetMapper 不可用时，返回空统计（零值/空列表）以保证系统可用性。
 */
@Slf4j
@Service
public class ReportService {

    @Autowired(required = false)
    private AssetMapper assetMapper;

    /**
     * 获取资产汇总统计。
     *
     * <p>统计指标包括：
     * <ul>
     *   <li>totalAssets — 资产总数</li>
     *   <li>activeAssets — 在用资产数（status = IN_USE）</li>
     *   <li>pendingApproval — 待审批数（status = PENDING_APPROVAL）</li>
     *   <li>recentlyRetired — 近期退役数（status = RETIRED）</li>
     * </ul>
     *
     * @return 汇总统计 DTO
     */
    public ReportSummaryDTO getSummary() {
        ReportSummaryDTO.ReportSummaryDTOBuilder builder = ReportSummaryDTO.builder()
                .totalAssets(0)
                .activeAssets(0)
                .pendingApproval(0)
                .recentlyRetired(0);

        if (assetMapper == null) {
            log.warn("AssetMapper not available, returning zeroed summary");
            return builder.build();
        }

        try {
            builder.totalAssets(countByCondition(null));
            builder.activeAssets(countByCondition("IN_USE"));
            builder.pendingApproval(countByCondition("PENDING_APPROVAL"));
            builder.recentlyRetired(countByCondition("RETIRED"));
        } catch (Exception e) {
            log.error("Failed to query asset summary, returning zeroed values", e);
        }

        return builder.build();
    }

    /**
     * 获取按分类统计的资产列表。
     *
     * <p>返回按资产分类分组的统计数据。当前迭代返回空列表。
     *
     * @return 分类统计列表
     */
    public List<CategoryReportDTO> getByCategory() {
        if (assetMapper == null) {
            log.warn("AssetMapper not available, returning empty category list");
            return Collections.emptyList();
        }

        try {
            // Placeholder for future category-based aggregation
            return Collections.emptyList();
        } catch (Exception e) {
            log.error("Failed to query asset categories, returning empty list", e);
            return Collections.emptyList();
        }
    }

    /**
     * 根据状态条件查询资产数量。
     *
     * @param status 资产状态，为 null 时查询全部
     * @return 符合条件的资产数量
     */
    private Long countByCondition(String status) {
        QueryWrapper<Asset> wrapper = new QueryWrapper<>();
        if (status != null && !status.isEmpty()) {
            wrapper.eq("status", status);
        }
        return assetMapper.selectCount(wrapper);
    }
}
