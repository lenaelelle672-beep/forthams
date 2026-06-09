package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.entity.EnergyConsumption;
import com.ams.entity.EnergyMeter;
import com.ams.entity.Location;
import com.ams.entity.LocationType;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.EnergyConsumptionMapper;
import com.ams.mapper.EnergyMeterMapper;
import com.ams.mapper.LocationMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 能耗服务
 *
 * 提供读数管理、月度汇总计算、仪表盘汇总、空间层级聚合
 */
@Service
@RequiredArgsConstructor
public class EnergyService {

    private final EnergyMeterMapper energyMeterMapper;
    private final EnergyConsumptionMapper energyConsumptionMapper;
    private final LocationMapper locationMapper;
    private final LocationService locationService;
    private final AssetMapper assetMapper;

    // ── 读数管理 ───────────────────────────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public EnergyMeter addReading(EnergyMeter meter) {
        requireTenantAsset(meter.getAssetId());
        if (meter.getUnit() == null) {
            meter.setUnit("kWh");
        }
        energyMeterMapper.insert(meter);
        return meter;
    }

    public List<EnergyMeter> getReadings(Long assetId, String meterType,
                                          LocalDate startDate, LocalDate endDate) {
        // R12 缓解：先解析本租户资产 ID 白名单，再做 IN 过滤
        List<Long> tenantAssetIds = resolveTenantAssetIds();
        if (tenantAssetIds.isEmpty()) return List.of();

        LambdaQueryWrapper<EnergyMeter> wrapper = new LambdaQueryWrapper<>();
        if (assetId != null) {
            if (!tenantAssetIds.contains(assetId)) return List.of();
            wrapper.eq(EnergyMeter::getAssetId, assetId);
        } else {
            wrapper.in(EnergyMeter::getAssetId, tenantAssetIds);
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
        // R12 缓解：先解析本租户资产 ID 白名单，再做 IN 过滤
        List<Long> tenantAssetIds = resolveTenantAssetIds();
        if (tenantAssetIds.isEmpty()) return List.of();

        LambdaQueryWrapper<EnergyConsumption> wrapper = new LambdaQueryWrapper<>();
        if (assetId != null) {
            if (!tenantAssetIds.contains(assetId)) return List.of();
            wrapper.eq(EnergyConsumption::getAssetId, assetId);
        } else {
            wrapper.in(EnergyConsumption::getAssetId, tenantAssetIds);
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
     * 计算指定资产在给定月份内的月度能耗（保留向后兼容）
     */
    @Transactional(rollbackFor = Exception.class)
    public EnergyConsumption calculateMonthlyConsumption(Long assetId, String meterType,
                                                          int year, int month) {
        // S2-patch：委托给参数化的 calculatePeriodConsumption
        YearMonth ym = YearMonth.of(year, month);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();
        return calculatePeriodConsumption(assetId, meterType, "MONTH", start, end);
    }

    /**
     * S2-patch: 参数化版本 — 接受任意 periodType（DAY/WEEK/MONTH/YEAR）
     * 与 TimeRangeSelector 5 枚举（day/week/month/year/custom）对齐；custom 由调用方拆分为 start/end 传入。
     */
    @Transactional(rollbackFor = Exception.class)
    public EnergyConsumption calculatePeriodConsumption(Long assetId, String meterType,
                                                          String periodType, LocalDate start, LocalDate end) {
        // 大小写规范化（R8 / B2）
        String pt = periodType == null || periodType.isBlank() ? "MONTH" : periodType.toUpperCase();

        List<EnergyMeter> readings = getReadings(assetId, meterType, start, end);
        if (readings.isEmpty()) {
            return null;
        }

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

        LambdaQueryWrapper<EnergyConsumption> existWrapper = new LambdaQueryWrapper<EnergyConsumption>()
                .eq(EnergyConsumption::getAssetId, assetId)
                .eq(EnergyConsumption::getMeterType, meterType)
                .eq(EnergyConsumption::getPeriodType, pt)
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
        ec.setPeriodType(pt);
        ec.setPeriodStart(start);
        ec.setPeriodEnd(end);
        ec.setConsumption(consumption);
        ec.setUnit(unit);
        energyConsumptionMapper.insert(ec);
        return ec;
    }

    // ── 仪表盘数据 ────────────────────────────────────────────────────────────

    /**
     * 仪表盘数据（B2 修复：支持可选时间范围 + 空间过滤）
     *
     * - 全部参数 null 时 fallback 近 12 个月全量
     * - periodType=null 时按 MONTH 汇总（保持既有行为）
     * - locationId 非空时只聚合 cascade 子树下的资产
     *
     * 公开返回 shape：
     * - byType: 按类型分类汇总（用电/用水/用气）
     * - trend: 月度或自定义粒度趋势
     * - assetRanking: TOP 10 资产排名
     * - total: byType 求和
     * - periodType: 实际使用的 periodType
     */
    public Map<String, Object> getDashboardData(LocalDate startDate, LocalDate endDate,
                                                 String periodType, Long locationId) {
        Map<String, Object> result = new LinkedHashMap<>();

        // 1. 解析时间范围
        LocalDate effectiveStart = startDate != null ? startDate : LocalDate.now().minusMonths(12).withDayOfMonth(1);
        LocalDate effectiveEnd = endDate != null ? endDate : LocalDate.now();
        String effectivePeriod = (periodType == null || periodType.isBlank()) ? "MONTH" : periodType.toUpperCase();

        result.put("periodType", effectivePeriod);

        // 2. 查询记录
        List<EnergyConsumption> records = loadConsumptionInRange(effectiveStart, effectiveEnd, effectivePeriod, locationId);

        // 3. byType
        Map<String, BigDecimal> byType = records.stream()
                .collect(Collectors.groupingBy(
                        EnergyConsumption::getMeterType,
                        Collectors.reducing(BigDecimal.ZERO,
                                EnergyConsumption::getConsumption,
                                BigDecimal::add)
                ));
        result.put("byType", byType);

        // 4. trend — 按 effectivePeriod 粒度生成时间桶
        Map<String, BigDecimal> trend = new LinkedHashMap<>();
        List<LocalDate> buckets = generateTimeBuckets(effectiveStart, effectiveEnd, effectivePeriod);
        for (LocalDate bucketStart : buckets) {
            String key = formatBucketKey(bucketStart, effectivePeriod);
            BigDecimal bucketTotal = records.stream()
                    .filter(r -> r.getPeriodStart() != null && isInBucket(r.getPeriodStart(), bucketStart, effectivePeriod))
                    .map(EnergyConsumption::getConsumption)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            trend.put(key, bucketTotal);
        }
        result.put("trend", trend);

        // 5. assetRanking — TOP 10
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

        // 6. total
        BigDecimal total = byType.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        result.put("total", total);

        return result;
    }

    /**
     * 按空间层级聚合能耗（B1 新增：dashboard 兼容 shape）
     * 返回 Map{byType, trend, assetRanking, total}
     */
    public Map<String, Object> getSummaryByLocation(Long locationId, LocalDate startDate,
                                                      LocalDate endDate, String periodType) {
        if (locationId == null) {
            return Map.of("byType", Map.of(), "trend", Map.of(), "assetRanking", List.of(), "total", BigDecimal.ZERO);
        }
        // 复用 getDashboardData 但强制 locationId
        return getDashboardData(startDate, endDate, periodType, locationId);
    }

    /**
     * 按空间层级返回周期聚合读数（List 形式）
     */
    public List<EnergyConsumption> getConsumptionByLocation(Long locationId, LocalDate startDate,
                                                              LocalDate endDate, String periodType) {
        if (locationId == null) return List.of();
        LocalDate effectiveStart = startDate != null ? startDate : LocalDate.now().minusMonths(12).withDayOfMonth(1);
        LocalDate effectiveEnd = endDate != null ? endDate : LocalDate.now();
        String effectivePeriod = (periodType == null || periodType.isBlank()) ? "MONTH" : periodType.toUpperCase();
        return loadConsumptionInRange(effectiveStart, effectiveEnd, effectivePeriod, locationId);
    }

    // ── 私有辅助 ──────────────────────────────────────────────────────────────

    /**
     * 加载时间范围内 + 空间范围内（可选）的能耗记录
     * 空间过滤：先 LocationMapper.findDescendants 拿 cascade ids，
     * 再查 energy_consumption.asset_id IN 子集（Java 内存 IN 比 SQL 递归更易控）
     *
     * R12 缓解：asset 端先按本租户 ID 过滤，得到 tenantAssetIds；
     * 之后所有能耗查询都 AND (asset_id IN tenantAssetIds)，实现多租户隔离。
     */
    private List<EnergyConsumption> loadConsumptionInRange(LocalDate start, LocalDate end,
                                                             String periodType, Long locationId) {
        if (locationId == null) {
            List<Long> tenantAssetIds = resolveTenantAssetIds();
            if (tenantAssetIds.isEmpty()) return List.of();
            LambdaQueryWrapper<EnergyConsumption> wrapper = new LambdaQueryWrapper<EnergyConsumption>()
                    .in(EnergyConsumption::getAssetId, tenantAssetIds)
                    .eq(EnergyConsumption::getPeriodType, periodType)
                    .ge(EnergyConsumption::getPeriodStart, start)
                    .le(EnergyConsumption::getPeriodStart, end);
            return energyConsumptionMapper.selectList(wrapper);
        }
        // cascade 预热：S0.5f — 含 root 自身
        List<Long> locationIds = locationService.getCascadeIdsWithRoot(locationId);
        if (locationIds.isEmpty()) return List.of();
        return energyConsumptionMapper.selectByLocationIds(locationIds, start, end, periodType);
    }

    /**
     * R12 解析：返回本租户的所有 asset id 列表
     * 缺失租户上下文时返回空集合（拒绝任何数据），由 TenantContext.requireTenantId() 兜底抛 AccessDenied
     */
    private List<Long> resolveTenantAssetIds() {
        try {
            String tenantId = TenantContext.requireTenantId();
            return assetMapper.selectList(
                    new LambdaQueryWrapper<Asset>()
                            .eq(Asset::getTenantId, tenantId)
                            .select(Asset::getId)
            ).stream().map(Asset::getId).collect(Collectors.toList());
        } catch (Exception e) {
            return List.of();
        }
    }

    private void requireTenantAsset(Long assetId) {
        if (assetId == null) {
            throw new AccessDeniedException("Missing energy asset identifier");
        }
        String tenantId = TenantContext.requireTenantId();
        Long count = assetMapper.selectCount(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getId, assetId)
                .eq(Asset::getTenantId, tenantId));
        if (count == null || count <= 0) {
            throw new AccessDeniedException("Energy asset is outside current tenant");
        }
    }

    /** 生成时间桶起点列表（按 DAY/WEEK/MONTH/YEAR） */
    private List<LocalDate> generateTimeBuckets(LocalDate start, LocalDate end, String periodType) {
        List<LocalDate> out = new ArrayList<>();
        LocalDate cur = switch (periodType) {
            case "DAY" -> start;
            case "WEEK" -> start;
            case "YEAR" -> start.withDayOfYear(1);
            default -> start.withDayOfMonth(1);
        };
        while (!cur.isAfter(end)) {
            out.add(cur);
            cur = switch (periodType) {
                case "DAY" -> cur.plusDays(1);
                case "WEEK" -> cur.plusWeeks(1);
                case "YEAR" -> cur.plusYears(1);
                default -> cur.plusMonths(1);
            };
        }
        return out;
    }

    /** 桶 key 格式化（YYYY-MM-DD / YYYY-MM / YYYY） */
    private String formatBucketKey(LocalDate date, String periodType) {
        return switch (periodType) {
            case "DAY" -> date.toString();
            case "YEAR" -> String.valueOf(date.getYear());
            default -> date.getYear() + "-" + String.format("%02d", date.getMonthValue());
        };
    }

    /** 判断 periodStart 是否在 bucket 范围内 */
    private boolean isInBucket(LocalDate periodStart, LocalDate bucketStart, String periodType) {
        return switch (periodType) {
            case "DAY" -> periodStart.isEqual(bucketStart);
            case "WEEK" -> {
                LocalDate bucketEnd = bucketStart.plusDays(6);
                yield !periodStart.isBefore(bucketStart) && !periodStart.isAfter(bucketEnd);
            }
            case "YEAR" -> periodStart.getYear() == bucketStart.getYear();
            default -> periodStart.getYear() == bucketStart.getYear() && periodStart.getMonthValue() == bucketStart.getMonthValue();
        };
    }

    // ── W4 增量化扩展：PeriodType 枚举 + 空间聚合 (R13 / A1) ────────────────────

    /**
     * 周期粒度枚举（W4 增量化：替换硬编码 "MONTH" 字符串，V3_11__energy.sql 表注释 DAY/MONTH/YEAR 对齐）。
     * 与 EnergyConsumption.periodType 列值严格一致。
     */
    public enum PeriodType {
        DAY, WEEK, MONTH, YEAR;

        public static PeriodType of(String s) {
            if (s == null || s.isBlank()) return MONTH;
            try {
                return PeriodType.valueOf(s.toUpperCase());
            } catch (IllegalArgumentException ex) {
                return MONTH;
            }
        }
    }

    /**
     * 按空间层级聚合能耗（W4 新增 — 建筑/楼层/区域下钻）。
     * - type=BUILDING：返回所有 BUILDING 节点 + 每个 BUILDING 自身的能耗（assetId 落在该 BUILDING 及其 cascade 子树内）
     * - type=FLOOR / ROOM：必须传 parentId（建筑 ID），返回该 parent 下所有该 type 子节点的能耗
     * - 与 getDashboardData 保持相同 shape：{byType, trend, assetRanking, total, periodType}
     */
    public List<Map<String, Object>> aggregateBySpace(LocationType type, Long parentId,
                                                        String periodType, LocalDate start, LocalDate end) {
        if (type == null) {
            return List.of();
        }
        PeriodType pt = PeriodType.of(periodType);
        LocalDate effectiveStart = start != null ? start : LocalDate.now().minusMonths(12).withDayOfMonth(1);
        LocalDate effectiveEnd = end != null ? end : LocalDate.now();

        List<Location> targetLocations;
        if (type.isAssetLevel() && parentId != null) {
            // 资产型空间下钻：拿 parentId 的 cascade 子树（service 层递归，避开 CTE 与 TenantLineInnerInterceptor 冲突）
            List<Long> cascadeIds = locationService.getCascadeIdsWithRoot(parentId);
            targetLocations = cascadeIds == null ? List.of()
                    : cascadeIds.stream()
                    .map(locationService::findById)
                    .filter(Objects::nonNull)
                    .filter(l -> type.name().equalsIgnoreCase(l.getLocationType()))
                    .collect(Collectors.toList());
        } else {
            // 顶级 BUILDING 列表
            targetLocations = locationMapper.findRootLocations().stream()
                    .filter(l -> type.name().equalsIgnoreCase(l.getLocationType()))
                    .collect(Collectors.toList());
        }

        List<Map<String, Object>> out = new ArrayList<>();
        for (Location loc : targetLocations) {
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("locationId", loc.getId());
            node.put("locationName", loc.getName());
            node.put("locationType", loc.getLocationType());

            // 复用 getSummaryByLocation 拿单空间聚合
            Map<String, Object> inner = getSummaryByLocation(loc.getId(), effectiveStart, effectiveEnd, pt.name());
            node.put("byType", inner.get("byType"));
            node.put("trend", inner.get("trend"));
            node.put("assetRanking", inner.get("assetRanking"));
            node.put("total", inner.get("total"));
            out.add(node);
        }
        return out;
    }

    // ── W24 增量化扩展：同环比 + 排名 + 异常 + 空间下资产（A3 增强 4） ──────────

    /**
     * 同环比对比（W24 step2 — 替换前端 trendChange 客户端算法）。
     * 返回 {current: Map<bucketKey, BigDecimal>, previous: Map<bucketKey, BigDecimal>, changeRate: BigDecimal}。
     */
    public Map<String, Object> compareRange(LocalDate currentStart, LocalDate currentEnd,
                                              LocalDate previousStart, LocalDate previousEnd,
                                              String periodType) {
        Map<String, BigDecimal> current = bucketByPeriod(currentStart, currentEnd, periodType);
        Map<String, BigDecimal> previous = bucketByPeriod(previousStart, previousEnd, periodType);
        BigDecimal curTotal = current.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal prevTotal = previous.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal changeRate = prevTotal.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : curTotal.subtract(prevTotal).multiply(BigDecimal.valueOf(100))
                        .divide(prevTotal, 2, RoundingMode.HALF_UP);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("current", current);
        out.put("previous", previous);
        out.put("changeRate", changeRate);
        out.put("currentTotal", curTotal);
        out.put("previousTotal", prevTotal);
        return out;
    }

    /**
     * 跨维度排名（W24 step2 — scope: asset / building / floor / area）。
     * building/floor/area scope 走 location 表 GROUP BY；asset scope 走 EnergyConsumption.assetId GROUP BY。
     */
    public List<Map<String, Object>> rankingByScope(String scope, String periodType,
                                                       String meterType, Integer limit) {
        if (scope == null) return List.of();
        Integer topN = (limit == null || limit <= 0) ? 10 : limit;
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusMonths(12);
        String pt = PeriodType.of(periodType).name();

        if ("asset".equalsIgnoreCase(scope)) {
            return energyConsumptionMapper.rankingByAsset(start, end, pt, meterType, topN);
        }
        // building/floor/area: 走 location GROUP BY（不依赖 R9 修复后即可工作）
        LocationType type = switch (scope.toLowerCase()) {
            case "building" -> LocationType.BUILDING;
            case "floor" -> LocationType.FLOOR;
            case "area", "room" -> LocationType.ROOM;
            default -> null;
        };
        if (type == null) return List.of();
        return energyConsumptionMapper.rankingByLocation(type.name(), start, end, pt, meterType, topN);
    }

    /**
     * 异常检测（W24 step2 — 替换前端 detectAnomalies 客户端 z-score）。
     * method=zscore | stddev，threshold 单位为 σ。
     */
    public List<Map<String, Object>> detectAnomaliesAuthority(LocalDate start, LocalDate end,
                                                                 String periodType, String method, Double threshold) {
        Map<String, BigDecimal> buckets = bucketByPeriod(start, end, periodType);
        if (buckets.isEmpty()) return List.of();

        List<BigDecimal> values = new ArrayList<>(buckets.values());
        BigDecimal mean = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(values.size()), 4, RoundingMode.HALF_UP);
        // 标准差
        BigDecimal variance = BigDecimal.ZERO;
        for (BigDecimal v : values) {
            BigDecimal diff = v.subtract(mean);
            variance = variance.add(diff.multiply(diff));
        }
        variance = variance.divide(BigDecimal.valueOf(values.size()), 4, RoundingMode.HALF_UP);
        BigDecimal stddev = BigDecimal.valueOf(Math.sqrt(variance.doubleValue()));
        BigDecimal thr = BigDecimal.valueOf(threshold == null ? 1.5 : threshold);

        List<Map<String, Object>> out = new ArrayList<>();
        int idx = 0;
        for (Map.Entry<String, BigDecimal> e : buckets.entrySet()) {
            BigDecimal z = stddev.compareTo(BigDecimal.ZERO) == 0
                    ? BigDecimal.ZERO
                    : e.getValue().subtract(mean).divide(stddev, 2, RoundingMode.HALF_UP);
            if (z.abs().compareTo(thr) >= 0) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("period", e.getKey());
                item.put("value", e.getValue());
                item.put("expected", mean);
                item.put("deviation", z);
                item.put("severity", z.abs().compareTo(BigDecimal.valueOf(2.5)) >= 0 ? "high"
                        : z.abs().compareTo(BigDecimal.valueOf(2.0)) >= 0 ? "medium" : "low");
                out.add(item);
            }
            idx++;
        }
        return out;
    }

    /**
     * 空间下资产 + 能耗（W24 step2 — GIS 选建筑 → 该空间下资产与能耗联动）。
     * JOIN asset → energy_consumption，GROUP BY asset.id。
     */
    public List<Map<String, Object>> getLocationAssetsWithEnergy(Long locationId, String periodType,
                                                                   Boolean withEnergy) {
        if (locationId == null) return List.of();
        LocalDate end = LocalDate.now();
        LocalDate start = end.minusMonths(12);
        String pt = PeriodType.of(periodType).name();
        return energyConsumptionMapper.assetsByLocation(locationId, start, end, pt, Boolean.TRUE.equals(withEnergy));
    }

    /**
     * 按时间桶汇总能耗（compareRange / detectAnomaliesAuthority 复用）。
     * 直接读 energy_consumption 限定 periodType + periodStart 范围，按 periodStart 桶聚合。
     */
    private Map<String, BigDecimal> bucketByPeriod(LocalDate start, LocalDate end, String periodType) {
        if (start == null || end == null) return Map.of();
        List<Long> tenantAssetIds = resolveTenantAssetIds();
        if (tenantAssetIds.isEmpty()) return Map.of();
        String pt = PeriodType.of(periodType).name();
        LambdaQueryWrapper<EnergyConsumption> wrapper = new LambdaQueryWrapper<EnergyConsumption>()
                .in(EnergyConsumption::getAssetId, tenantAssetIds)
                .eq(EnergyConsumption::getPeriodType, pt)
                .ge(EnergyConsumption::getPeriodStart, start)
                .le(EnergyConsumption::getPeriodStart, end);
        List<EnergyConsumption> records = energyConsumptionMapper.selectList(wrapper);
        Map<String, BigDecimal> out = new LinkedHashMap<>();
        for (EnergyConsumption r : records) {
            if (r.getPeriodStart() == null) continue;
            String key = formatBucketKey(r.getPeriodStart(), pt);
            out.merge(key, r.getConsumption() == null ? BigDecimal.ZERO : r.getConsumption(), BigDecimal::add);
        }
        return out;
    }
}
