package com.ams.service;

import com.ams.dto.CategoryReportDTO;
import com.ams.dto.ReportMonthlyDTO;
import com.ams.dto.ReportSummaryDTO;
import com.ams.dto.ReportTrendDTO;
import com.ams.entity.Asset;
import com.ams.entity.AssetCategory;
import com.ams.entity.MaintenanceRecord;
import com.ams.entity.RetirementApplication;
import com.ams.mapper.AssetCategoryMapper;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.MaintenanceRecordMapper;
import com.ams.mapper.RetirementApplicationMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 资产报表服务
 *
 * <p>提供资产汇总统计、分类统计、趋势查询以及月度统计（折旧/维保/退役处置）能力。
 * 当 Mapper 不可用时，返回空统计（零值/空列表）以保证系统可用性。
 */
@Slf4j
@Service
public class ReportService {

    @Autowired(required = false)
    private AssetMapper assetMapper;

    @Autowired(required = false)
    private AssetCategoryMapper assetCategoryMapper;

    @Autowired(required = false)
    private MaintenanceRecordMapper maintenanceRecordMapper;

    @Autowired(required = false)
    private RetirementApplicationMapper retirementApplicationMapper;

    /**
     * 获取资产汇总统计。
     *
     * @return 汇总数据（totalAssets, activeAssets, pendingApproval, recentlyRetired）
     */
    public ReportSummaryDTO getSummary() {
        if (assetMapper == null) {
            log.warn("AssetMapper is not available, returning empty summary");
            return ReportSummaryDTO.builder()
                    .totalAssets(0)
                    .activeAssets(0)
                    .pendingApproval(0)
                    .recentlyRetired(0)
                    .build();
        }

        try {
            long totalAssets = assetMapper.selectCount(new QueryWrapper<>());
            List<Asset> allAssets = assetMapper.selectList(null);
            long activeAssets = allAssets.stream().filter(a -> "IN_USE".equals(a.getStatus())).count();
            long pendingApproval = allAssets.stream().filter(a -> "PENDING_APPROVAL".equals(a.getStatus())).count();
            long recentlyRetired = allAssets.stream().filter(a -> "RETIRED".equals(a.getStatus())).count();

            return ReportSummaryDTO.builder()
                    .totalAssets(totalAssets)
                    .activeAssets(activeAssets)
                    .pendingApproval(pendingApproval)
                    .recentlyRetired(recentlyRetired)
                    .build();
        } catch (Exception e) {
            log.error("Failed to query asset summary, returning empty summary", e);
            return ReportSummaryDTO.builder()
                    .totalAssets(0)
                    .activeAssets(0)
                    .pendingApproval(0)
                    .recentlyRetired(0)
                    .build();
        }
    }

    /**
     * 获取按分类统计的资产数据。
     *
     * <p>使用 AssetMapper.selectCategoryReport() 的 SQL LEFT JOIN + GROUP BY 聚合查询，
     * 相比 Java stream 方式性能更优（数据库层完成聚合）。
     *
     * @return 分类统计列表
     */
    public List<CategoryReportDTO> getByCategory() {
        if (assetMapper == null) {
            log.warn("AssetMapper is not available, returning empty category report");
            return Collections.emptyList();
        }

        try {
            // 使用 SQL 级 GROUP BY 聚合查询
            List<Map<String, Object>> rows = assetMapper.selectCategoryReport();
            if (rows == null || rows.isEmpty()) {
                return Collections.emptyList();
            }

            return rows.stream()
                    .map(row -> CategoryReportDTO.builder()
                            .categoryName((String) row.get("categoryName"))
                            .assetCount(row.get("assetCount") instanceof Number
                                    ? ((Number) row.get("assetCount")).longValue()
                                    : 0L)
                            .totalValue(row.get("totalValue") instanceof Number
                                    ? ((Number) row.get("totalValue")).doubleValue()
                                    : 0.0)
                            .build())
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Failed to query category report, returning empty list", e);
            return Collections.emptyList();
        }
    }

    /**
     * 获取资产月度趋势数据。
     *
     * <p>统计近 12 个月（含本月）的资产总价值和净值月度变化，
     * 用于 ReportCenterPage 的趋势折线图。
     *
     * @return 月度趋势列表（最近 12 个月）
     */
    public List<ReportTrendDTO> getTrend() {
        if (assetMapper == null) {
            log.warn("AssetMapper is not available, returning empty trend");
            return Collections.emptyList();
        }

        try {
            // 查询全部资产
            List<Asset> allAssets = assetMapper.selectList(
                    new QueryWrapper<Asset>()
                            .select("purchase_date", "original_value", "current_value", "status")
            );

            if (allAssets.isEmpty()) {
                return Collections.emptyList();
            }

            // 生成最近 12 个月的标签（YYYY-MM）
            LocalDate now = LocalDate.now();
            List<String> months = new ArrayList<>();
            for (int i = 11; i >= 0; i--) {
                LocalDate m = now.minusMonths(i);
                months.add(m.getYear() + "-" + String.format("%02d", m.getMonthValue()));
            }

            // 对每个月份，模拟该时间点的资产状态（基于 purchase_date 和 status）
            List<ReportTrendDTO> trends = new ArrayList<>();
            for (String month : months) {
                int year = Integer.parseInt(month.substring(0, 4));
                int monthVal = Integer.parseInt(month.substring(5, 7));
                LocalDate monthEnd = LocalDate.of(year, monthVal, 1)
                        .plusMonths(1).minusDays(1);

                double totalValue = 0;
                double netValue = 0;

                for (Asset a : allAssets) {
                    if (a.getPurchaseDate() != null && !a.getPurchaseDate().isAfter(monthEnd)) {
                        BigDecimal ov = a.getOriginalValue();
                        BigDecimal cv = a.getCurrentValue();
                        totalValue += ov != null ? ov.doubleValue() : 0;
                        netValue += cv != null ? cv.doubleValue() : 0;
                    }
                }

                trends.add(ReportTrendDTO.builder()
                        .month(month)
                        .totalValue(Math.round(totalValue * 100.0) / 100.0)
                        .netValue(Math.round(netValue * 100.0) / 100.0)
                        .build());
            }

            return trends;
        } catch (Exception e) {
            log.error("Failed to query trend data, returning empty list", e);
            return Collections.emptyList();
        }
    }

    // ── 月度统计方法（折旧/维保/退役处置）─────────────────────────────────────────

    /**
     * 获取折旧月度统计。
     *
     * <p>从 Asset 表查询所有资产，按 purchase_date 汇总月度折旧金额。
     * 折旧金额 = original_value - current_value（差值即为累计折旧）。
     * 按月分组后生成最近 12 个月的折旧分布数据。
     *
     * @return 月度折旧列表（最近 12 个月）
     */
    public List<ReportMonthlyDTO> getDepreciationStats() {
        if (assetMapper == null) {
            log.warn("AssetMapper is not available, returning empty depreciation stats");
            return Collections.emptyList();
        }

        try {
            List<Asset> allAssets = assetMapper.selectList(
                    new QueryWrapper<Asset>().select("purchase_date", "original_value", "current_value")
            );

            // 按购买月份汇总折旧金额
            Map<String, Double> monthMap = new HashMap<>();
            for (Asset a : allAssets) {
                if (a.getPurchaseDate() == null) continue;
                String monthKey = a.getPurchaseDate().getYear() + "-"
                        + String.format("%02d", a.getPurchaseDate().getMonthValue());
                BigDecimal ov = a.getOriginalValue();
                BigDecimal cv = a.getCurrentValue();
                double depreciation = (ov != null ? ov.doubleValue() : 0)
                        - (cv != null ? cv.doubleValue() : 0);
                monthMap.merge(monthKey, Math.max(0, depreciation), Double::sum);
            }

            // 生成最近 12 个月的结果
            LocalDate now = LocalDate.now();
            List<ReportMonthlyDTO> result = new ArrayList<>();
            for (int i = 11; i >= 0; i--) {
                LocalDate m = now.minusMonths(i);
                String monthKey = m.getYear() + "-" + String.format("%02d", m.getMonthValue());
                result.add(ReportMonthlyDTO.builder()
                        .month(m.getMonthValue() + "月")
                        .value(Math.round(monthMap.getOrDefault(monthKey, 0.0) * 100.0) / 100.0)
                        .build());
            }

            return result;
        } catch (Exception e) {
            log.error("Failed to query depreciation stats, returning empty list", e);
            return Collections.emptyList();
        }
    }

    /**
     * 获取维保月度统计。
     *
     * <p>从 MaintenanceRecord 表统计每月维保记录数。
     * 按 maintenance_date 按月分组计数，生成最近 12 个月的维保频次分布。
     *
     * @return 月度维保统计列表（最近 12 个月）
     */
    public List<ReportMonthlyDTO> getMaintenanceStats() {
        if (maintenanceRecordMapper == null) {
            log.warn("MaintenanceRecordMapper is not available, returning empty maintenance stats");
            return Collections.emptyList();
        }

        try {
            List<MaintenanceRecord> records = maintenanceRecordMapper.selectList(
                    new QueryWrapper<MaintenanceRecord>().select("maintenance_date")
            );

            // 按维保月份计数
            Map<String, Long> monthMap = new HashMap<>();
            for (MaintenanceRecord r : records) {
                if (r.getMaintenanceDate() == null) continue;
                String monthKey = r.getMaintenanceDate().getYear() + "-"
                        + String.format("%02d", r.getMaintenanceDate().getMonthValue());
                monthMap.merge(monthKey, 1L, Long::sum);
            }

            // 生成最近 12 个月的结果
            LocalDate now = LocalDate.now();
            List<ReportMonthlyDTO> result = new ArrayList<>();
            for (int i = 11; i >= 0; i--) {
                LocalDate m = now.minusMonths(i);
                String monthKey = m.getYear() + "-" + String.format("%02d", m.getMonthValue());
                result.add(ReportMonthlyDTO.builder()
                        .month(m.getMonthValue() + "月")
                        .value(monthMap.getOrDefault(monthKey, 0L).doubleValue())
                        .build());
            }

            return result;
        } catch (Exception e) {
            log.error("Failed to query maintenance stats, returning empty list", e);
            return Collections.emptyList();
        }
    }

    /**
     * 获取退役处置月度统计。
     *
     * <p>从 RetirementApplication 表统计每月退役申请数。
     * 按 create_time 按月分组计数，生成最近 12 个月的退役处置趋势。
     *
     * @return 月度退役统计列表（最近 12 个月）
     */
    public List<ReportMonthlyDTO> getRetirementStats() {
        if (retirementApplicationMapper == null) {
            log.warn("RetirementApplicationMapper is not available, returning empty retirement stats");
            return Collections.emptyList();
        }

        try {
            List<RetirementApplication> applications = retirementApplicationMapper.selectList(
                    new QueryWrapper<RetirementApplication>().select("create_time")
            );

            // 按申请月份计数
            Map<String, Long> monthMap = new HashMap<>();
            for (RetirementApplication app : applications) {
                if (app.getCreateTime() == null) continue;
                String monthKey = app.getCreateTime().getYear() + "-"
                        + String.format("%02d", app.getCreateTime().getMonthValue());
                monthMap.merge(monthKey, 1L, Long::sum);
            }

            // 生成最近 12 个月的结果
            LocalDate now = LocalDate.now();
            List<ReportMonthlyDTO> result = new ArrayList<>();
            for (int i = 11; i >= 0; i--) {
                LocalDate m = now.minusMonths(i);
                String monthKey = m.getYear() + "-" + String.format("%02d", m.getMonthValue());
                result.add(ReportMonthlyDTO.builder()
                        .month(m.getMonthValue() + "月")
                        .value(monthMap.getOrDefault(monthKey, 0L).doubleValue())
                        .build());
            }

            return result;
        } catch (Exception e) {
            log.error("Failed to query retirement stats, returning empty list", e);
            return Collections.emptyList();
        }
    }
}
