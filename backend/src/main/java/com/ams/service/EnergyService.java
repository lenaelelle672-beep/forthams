package com.ams.service;

import com.ams.entity.EnergyConsumption;
import com.ams.entity.EnergyMeter;
import com.ams.mapper.EnergyConsumptionMapper;
import com.ams.mapper.EnergyMeterMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EnergyService {

    private final EnergyMeterMapper energyMeterMapper;
    private final EnergyConsumptionMapper energyConsumptionMapper;

    // ── 读数管理 ───────────────────────────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public EnergyMeter addReading(EnergyMeter meter) {
        if (meter.getUnit() == null) {
            meter.setUnit("kWh");
        }
        energyMeterMapper.insert(meter);
        return meter;
    }

    public List<EnergyMeter> getReadings(Long assetId, String meterType,
                                          LocalDate startDate, LocalDate endDate) {
        LambdaQueryWrapper<EnergyMeter> wrapper = new LambdaQueryWrapper<>();
        if (assetId != null) {
            wrapper.eq(EnergyMeter::getAssetId, assetId);
        }
        if (meterType != null && !meterType.isBlank()) {
            wrapper.eq(EnergyMeter::getMeterType, meterType);
        }
        if (startDate != null) {
            wrapper.ge(EnergyMeter::getReadingDate, startDate);
        }
        if (endDate != null) {
            wrapper.le(EnergyMeter::getReadingDate, endDate);
        }
        wrapper.orderByDesc(EnergyMeter::getReadingDate);
        return energyMeterMapper.selectList(wrapper);
    }

    // ── 能耗汇总 ───────────────────────────────────────────────────────────────

    public List<EnergyConsumption> getConsumptionSummary(Long assetId, String meterType,
                                                          String periodType,
                                                          LocalDate startDate, LocalDate endDate) {
        LambdaQueryWrapper<EnergyConsumption> wrapper = new LambdaQueryWrapper<>();
        if (assetId != null) {
            wrapper.eq(EnergyConsumption::getAssetId, assetId);
        }
        if (meterType != null && !meterType.isBlank()) {
            wrapper.eq(EnergyConsumption::getMeterType, meterType);
        }
        if (periodType != null && !periodType.isBlank()) {
            wrapper.eq(EnergyConsumption::getPeriodType, periodType);
        }
        if (startDate != null) {
            wrapper.ge(EnergyConsumption::getPeriodStart, startDate);
        }
        if (endDate != null) {
            wrapper.le(EnergyConsumption::getPeriodEnd, endDate);
        }
        wrapper.orderByDesc(EnergyConsumption::getPeriodStart);
        return energyConsumptionMapper.selectList(wrapper);
    }

    /**
     * 计算指定资产在给定月份内的月度能耗
     */
    @Transactional(rollbackFor = Exception.class)
    public EnergyConsumption calculateMonthlyConsumption(Long assetId, String meterType,
                                                          int year, int month) {
        YearMonth ym = YearMonth.of(year, month);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        // 查询该月所有读数
        List<EnergyMeter> readings = getReadings(assetId, meterType, start, end);
        if (readings.isEmpty()) {
            return null;
        }

        // 计算消耗量（最大读数 - 最小读数）
        BigDecimal minReading = readings.stream()
                .map(EnergyMeter::getReadingValue)
                .min(Comparator.naturalOrder())
                .orElse(BigDecimal.ZERO);
        BigDecimal maxReading = readings.stream()
                .map(EnergyMeter::getReadingValue)
                .max(Comparator.naturalOrder())
                .orElse(BigDecimal.ZERO);
        BigDecimal consumption = maxReading.subtract(minReading);

        String unit = readings.get(0).getUnit();
        if (unit == null) unit = "kWh";

        // 保存或更新汇总记录
        LambdaQueryWrapper<EnergyConsumption> existWrapper = new LambdaQueryWrapper<EnergyConsumption>()
                .eq(EnergyConsumption::getAssetId, assetId)
                .eq(EnergyConsumption::getMeterType, meterType)
                .eq(EnergyConsumption::getPeriodType, "MONTH")
                .eq(EnergyConsumption::getPeriodStart, start);

        EnergyConsumption existing = energyConsumptionMapper.selectOne(existWrapper);
        if (existing != null) {
            existing.setConsumption(consumption);
            existing.setPeriodEnd(end);
            existing.setUnit(unit);
            energyConsumptionMapper.updateById(existing);
            return existing;
        }

        EnergyConsumption ec = new EnergyConsumption();
        ec.setAssetId(assetId);
        ec.setMeterType(meterType);
        ec.setPeriodType("MONTH");
        ec.setPeriodStart(start);
        ec.setPeriodEnd(end);
        ec.setConsumption(consumption);
        ec.setUnit(unit);
        energyConsumptionMapper.insert(ec);
        return ec;
    }

    // ── 仪表盘数据 ────────────────────────────────────────────────────────────

    /**
     * 仪表盘数据：
     * - 按类型的能耗汇总（饼图）
     * - 近期能耗趋势（折线图）
     * - 资产能耗排名
     */
    public Map<String, Object> getDashboardData() {
        Map<String, Object> result = new LinkedHashMap<>();

        // 1. 按类型汇总（最近12个月的MONTH汇总）
        LocalDate oneYearAgo = LocalDate.now().minusMonths(12);
        LambdaQueryWrapper<EnergyConsumption> summaryWrapper = new LambdaQueryWrapper<EnergyConsumption>()
                .eq(EnergyConsumption::getPeriodType, "MONTH")
                .ge(EnergyConsumption::getPeriodStart, oneYearAgo);
        List<EnergyConsumption> records = energyConsumptionMapper.selectList(summaryWrapper);

        // 按类型分类汇总
        Map<String, BigDecimal> byType = records.stream()
                .collect(Collectors.groupingBy(
                        EnergyConsumption::getMeterType,
                        Collectors.reducing(BigDecimal.ZERO,
                                EnergyConsumption::getConsumption,
                                BigDecimal::add)
                ));
        result.put("byType", byType);

        // 2. 月度趋势（最近12个月逐月汇总）
        Map<String, BigDecimal> trend = new LinkedHashMap<>();
        for (int i = 11; i >= 0; i--) {
            LocalDate monthStart = LocalDate.now().minusMonths(i).withDayOfMonth(1);
            String key = monthStart.getYear() + "-" + String.format("%02d", monthStart.getMonthValue());
            BigDecimal monthTotal = records.stream()
                    .filter(r -> r.getPeriodStart().equals(monthStart))
                    .map(EnergyConsumption::getConsumption)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            trend.put(key, monthTotal);
        }
        result.put("trend", trend);

        // 3. 资产排名（按消耗量降序排列前10）
        Map<Long, BigDecimal> byAsset = records.stream()
                .filter(r -> r.getAssetId() != null)
                .collect(Collectors.groupingBy(
                        EnergyConsumption::getAssetId,
                        Collectors.reducing(BigDecimal.ZERO,
                                EnergyConsumption::getConsumption,
                                BigDecimal::add)
                ));
        List<Map.Entry<Long, BigDecimal>> sorted = byAsset.entrySet().stream()
                .sorted(Map.Entry.<Long, BigDecimal>comparingByValue().reversed())
                .limit(10)
                .collect(Collectors.toList());

        List<Map<String, Object>> assetRanking = new ArrayList<>();
        for (Map.Entry<Long, BigDecimal> entry : sorted) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("assetId", entry.getKey());
            item.put("consumption", entry.getValue());
            assetRanking.add(item);
        }
        result.put("assetRanking", assetRanking);

        return result;
    }
}
