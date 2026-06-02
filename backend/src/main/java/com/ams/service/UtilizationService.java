package com.ams.service;

import com.ams.dto.AssetUtilizationDTO;
import com.ams.dto.UtilizationOverviewDTO;
import com.ams.dto.UtilizationSummaryDTO;
import com.ams.dto.UtilizationTrendDTO;
import com.ams.entity.Asset;
import com.ams.entity.AssetUsageLog;
import com.ams.entity.AssetUtilizationSnapshot;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.AssetUsageLogMapper;
import com.ams.mapper.AssetUtilizationSnapshotMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UtilizationService {

    private static final BigDecimal WORK_HOURS_PER_DAY = new BigDecimal("8");
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final AssetUsageLogMapper usageLogMapper;
    private final AssetUtilizationSnapshotMapper snapshotMapper;
    private final AssetMapper assetMapper;

    @Transactional(rollbackFor = Exception.class)
    public void recordUsage(Long assetId, Long userId, String action, BigDecimal duration) {
        AssetUsageLog log = new AssetUsageLog();
        log.setAssetId(assetId);
        log.setUserId(userId);
        log.setAction(action);
        log.setUsageDate(LocalDate.now());
        log.setDurationHours(duration);
        usageLogMapper.insert(log);
    }

    public BigDecimal calculateUtilization(Long assetId, LocalDate startDate, LocalDate endDate) {
        Map<String, Object> usage = usageLogMapper.selectTotalUsage(assetId, startDate, endDate);
        BigDecimal usedHours = usage != null ? (BigDecimal) usage.get("totalHours") : BigDecimal.ZERO;
        BigDecimal totalHours = calculateWorkHours(startDate, endDate);
        if (totalHours.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return usedHours.multiply(HUNDRED).divide(totalHours, 2, RoundingMode.HALF_UP);
    }

    public List<UtilizationTrendDTO> getUtilizationTrend(Long assetId, String periodType, int months) {
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusMonths(months);

        List<Map<String, Object>> usageByMonth = usageLogMapper.selectUsageByMonth(assetId, startDate, endDate);

        Map<String, Map<String, Object>> usageMap = new LinkedHashMap<>();
        for (Map<String, Object> row : usageByMonth) {
            String month = (String) row.get("month");
            usageMap.put(month, row);
        }

        List<UtilizationTrendDTO> trends = new ArrayList<>();
        for (int i = months - 1; i >= 0; i--) {
            YearMonth ym = YearMonth.from(endDate).minusMonths(i);
            String monthKey = ym.toString();
            Map<String, Object> row = usageMap.get(monthKey);
            BigDecimal usedHours = BigDecimal.ZERO;
            if (row != null) {
                usedHours = (BigDecimal) row.get("totalHours");
            }
            LocalDate periodStart = ym.atDay(1);
            LocalDate periodEnd = ym.atEndOfMonth();
            BigDecimal totalHours = calculateWorkHours(periodStart, periodEnd);
            BigDecimal rate = totalHours.compareTo(BigDecimal.ZERO) > 0
                    ? usedHours.multiply(HUNDRED).divide(totalHours, 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;

            trends.add(UtilizationTrendDTO.builder()
                    .month(monthKey)
                    .totalHours(totalHours)
                    .usedHours(usedHours)
                    .utilizationRate(rate)
                    .build());
        }
        return trends;
    }

    public List<AssetUtilizationDTO> getTopUtilizedAssets(int limit, LocalDate startDate, LocalDate endDate) {
        List<Map<String, Object>> rows = usageLogMapper.selectTopUtilized(limit, startDate, endDate);
        List<AssetUtilizationDTO> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Long assetId = (Long) row.get("assetId");
            BigDecimal usedHours = (BigDecimal) row.get("totalHours");
            BigDecimal totalHours = calculateWorkHours(startDate, endDate);
            BigDecimal rate = totalHours.compareTo(BigDecimal.ZERO) > 0
                    ? usedHours.multiply(HUNDRED).divide(totalHours, 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;

            result.add(AssetUtilizationDTO.builder()
                    .assetId(assetId)
                    .assetName((String) row.get("assetName"))
                    .assetNo((String) row.get("assetNo"))
                    .usedHours(usedHours)
                    .totalHours(totalHours)
                    .utilizationRate(rate)
                    .lastUsedDate(Objects.toString(row.get("lastUsedDate"), null))
                    .build());
        }
        return result;
    }

    public List<AssetUtilizationDTO> getIdleAssets(int days) {
        List<Map<String, Object>> rows = usageLogMapper.selectIdleAssets(days);
        if (rows == null) return List.of();
        return rows.stream().filter(row -> row != null).map(row -> {
            Number idleDays = (Number) row.get("idleDays");
            return AssetUtilizationDTO.builder()
                .assetId((Long) row.get("assetId"))
                .assetName((String) row.get("assetName"))
                .assetNo((String) row.get("assetNo"))
                .status((String) row.get("status"))
                .idleDays(idleDays != null ? idleDays.intValue() : 0)
                .build();
        }).collect(Collectors.toList());
    }

    public UtilizationOverviewDTO getOverview(LocalDate startDate, LocalDate endDate) {
        List<AssetUtilizationDTO> top = getTopUtilizedAssets(100, startDate, endDate);
        long totalUsed = top.stream().filter(a -> a.getUsedHours().compareTo(BigDecimal.ZERO) > 0).count();
        long highCount = top.stream().filter(a -> {
            BigDecimal rate = a.getUtilizationRate();
            return rate != null && rate.compareTo(new BigDecimal("80")) >= 0;
        }).count();

        BigDecimal overallRate = BigDecimal.ZERO;
        if (!top.isEmpty()) {
            BigDecimal totalUsedHours = top.stream()
                    .map(a -> a.getUsedHours() != null ? a.getUsedHours() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalHours = top.stream()
                    .map(a -> a.getTotalHours() != null ? a.getTotalHours() : BigDecimal.ZERO)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (totalHours.compareTo(BigDecimal.ZERO) > 0) {
                overallRate = totalUsedHours.multiply(HUNDRED).divide(totalHours, 2, RoundingMode.HALF_UP);
            }
        }

        List<AssetUtilizationDTO> idle = getIdleAssets(30);
        long totalAssets = assetMapper.selectCount(
                new LambdaQueryWrapper<Asset>().eq(Asset::getDeleted, 0));

        return UtilizationOverviewDTO.builder()
                .overallUtilizationRate(overallRate)
                .idleAssetCount((long) idle.size())
                .inUseAssetCount(totalUsed)
                .highUtilizationCount(highCount)
                .build();
    }

    public List<UtilizationSummaryDTO> getSummaryByCategory(LocalDate startDate, LocalDate endDate) {
        List<Map<String, Object>> rows = usageLogMapper.selectSummaryByCategory(startDate, endDate);
        return rows.stream().map(row -> {
            BigDecimal usedHours = (BigDecimal) row.get("usedHours");
            BigDecimal totalHours = calculateWorkHours(startDate, endDate);
            BigDecimal rate = totalHours.compareTo(BigDecimal.ZERO) > 0
                    ? usedHours.multiply(HUNDRED).divide(totalHours, 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            return UtilizationSummaryDTO.builder()
                    .name((String) row.get("categoryName"))
                    .usedHours(usedHours)
                    .usedAssetCount(((Number) row.get("usedAssetCount")).longValue())
                    .totalAssetCount(((Number) row.get("totalAssetCount")).longValue())
                    .utilizationRate(rate)
                    .build();
        }).collect(Collectors.toList());
    }

    public List<UtilizationSummaryDTO> getSummaryByDept(LocalDate startDate, LocalDate endDate) {
        List<Map<String, Object>> rows = usageLogMapper.selectSummaryByDept(startDate, endDate);
        return rows.stream().map(row -> {
            BigDecimal usedHours = (BigDecimal) row.get("usedHours");
            BigDecimal totalHours = calculateWorkHours(startDate, endDate);
            BigDecimal rate = totalHours.compareTo(BigDecimal.ZERO) > 0
                    ? usedHours.multiply(HUNDRED).divide(totalHours, 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            return UtilizationSummaryDTO.builder()
                    .name((String) row.get("deptName"))
                    .usedHours(usedHours)
                    .usedAssetCount(((Number) row.get("usedAssetCount")).longValue())
                    .totalAssetCount(((Number) row.get("totalAssetCount")).longValue())
                    .utilizationRate(rate)
                    .build();
        }).collect(Collectors.toList());
    }

    @Transactional(rollbackFor = Exception.class)
    public void calculateMonthlySnapshot() {
        YearMonth lastMonth = YearMonth.from(LocalDate.now().minusMonths(1));
        LocalDate periodStart = lastMonth.atDay(1);
        LocalDate periodEnd = lastMonth.atEndOfMonth();

        int page = 1;
        int pageSize = 1000;
        boolean hasMore = true;

        BigDecimal totalHours = calculateWorkHours(periodStart, periodEnd);

        while (hasMore) {
            Page<Asset> assetPage = assetMapper.selectPage(
                    new Page<>(page, pageSize),
                    new LambdaQueryWrapper<Asset>().eq(Asset::getDeleted, 0));
            List<Asset> assets = assetPage.getRecords();
            if (assets.isEmpty()) {
                hasMore = false;
                break;
            }
            page++;

            for (Asset asset : assets) {
            Map<String, Object> usage = usageLogMapper.selectTotalUsage(asset.getId(), periodStart, periodEnd);
            BigDecimal usedHours = usage != null ? (BigDecimal) usage.get("totalHours") : BigDecimal.ZERO;
            BigDecimal rate = totalHours.compareTo(BigDecimal.ZERO) > 0
                    ? usedHours.multiply(HUNDRED).divide(totalHours, 2, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;
            BigDecimal idleHours = totalHours.subtract(usedHours);

            AssetUtilizationSnapshot snapshot = new AssetUtilizationSnapshot();
            snapshot.setAssetId(asset.getId());
            snapshot.setPeriodType("MONTHLY");
            snapshot.setPeriodStart(periodStart);
            snapshot.setPeriodEnd(periodEnd);
            snapshot.setTotalHours(totalHours);
            snapshot.setUsedHours(usedHours);
            snapshot.setUtilizationRate(rate);
            snapshot.setIdleHours(idleHours);
            snapshotMapper.insert(snapshot);
            }
        }
    }

    private BigDecimal calculateWorkHours(LocalDate start, LocalDate end) {
        long workDays = 0;
        LocalDate date = start;
        while (!date.isAfter(end)) {
            if (date.getDayOfWeek() != DayOfWeek.SATURDAY && date.getDayOfWeek() != DayOfWeek.SUNDAY) {
                workDays++;
            }
            date = date.plusDays(1);
        }
        return WORK_HOURS_PER_DAY.multiply(BigDecimal.valueOf(workDays));
    }

}
