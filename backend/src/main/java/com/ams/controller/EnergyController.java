package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.EnergyConsumption;
import com.ams.entity.EnergyMeter;
import com.ams.entity.LocationType;
import com.ams.service.EnergyService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 能耗管理 API
 *
 * <p>gai2 端点矩阵：</p>
 * <ul>
 *   <li>既有：/energy/meters、/energy/consumption、/energy/calculate-monthly</li>
 *   <li>W4/W5（W5 扩展原 dashboard + 新增 by-space + aggregate）：/energy/dashboard、/energy/summary/by-location、/energy/consumption/aggregate、/energy/by-space</li>
 *   <li>W25 step2 权威化（替换前端客户端 z-score 与 trendChange）：/energy/compare、/energy/ranking、/energy/anomalies、/energy/locations/{id}/assets</li>
 * </ul>
 */
@RestController
@RequestMapping("/energy")
@RequiredArgsConstructor
public class EnergyController {

    private final EnergyService energyService;

    // ── 既有端点 ──────────────────────────────────────────────────────────────

    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/meters")
    public Result<List<EnergyMeter>> getMeters(
            @RequestParam(required = false) Long assetId,
            @RequestParam(required = false) String meterType,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : null;
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : null;
        return Result.success(energyService.getReadings(assetId, meterType, start, end));
    }

    @PreAuthorize("@ss.hasPermi('asset:create')")
    @PostMapping("/meters")
    public Result<EnergyMeter> addMeter(@RequestBody EnergyMeter meter) {
        return Result.success(energyService.addReading(meter));
    }

    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/consumption")
    public Result<List<EnergyConsumption>> getConsumption(
            @RequestParam(required = false) Long assetId,
            @RequestParam(required = false) String meterType,
            @RequestParam(required = false) String periodType,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : null;
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : null;
        return Result.success(energyService.getConsumptionSummary(assetId, meterType, periodType, start, end));
    }

    @PreAuthorize("@ss.hasPermi('asset:edit')")
    @PostMapping("/calculate-monthly")
    public Result<EnergyConsumption> calculateMonthly(
            @RequestParam Long assetId,
            @RequestParam String meterType,
            @RequestParam int year,
            @RequestParam int month) {
        EnergyConsumption result = energyService.calculateMonthlyConsumption(assetId, meterType, year, month);
        if (result == null) {
            return Result.error("该月份没有读数记录");
        }
        return Result.success(result);
    }

    // ── gai2 W4/W5 端点（B1 扩展 + A3 MVP2 by-space） ────────────────────────

    /**
     * 仪表盘数据（4 参签名，向后兼容 default 12 个月 MONTH）。
     */
    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/dashboard")
    public Result<Map<String, Object>> dashboard(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String periodType,
            @RequestParam(required = false) Long locationId) {
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : null;
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : null;
        return Result.success(energyService.getDashboardData(start, end, periodType, locationId));
    }

    /**
     * 按空间层级聚合能耗（建筑/楼层/区域），返回与 dashboard 相同 shape 的 Map。
     */
    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/summary/by-location")
    public Result<Map<String, Object>> summaryByLocation(
            @RequestParam Long locationId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String periodType) {
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : null;
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : null;
        return Result.success(energyService.getSummaryByLocation(locationId, start, end, periodType));
    }

    /**
     * 按空间层级聚合能耗周期数据（List 形式）。
     */
    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/consumption/aggregate")
    public Result<List<EnergyConsumption>> aggregate(
            @RequestParam Long locationId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String periodType) {
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : null;
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : null;
        return Result.success(energyService.getConsumptionByLocation(locationId, start, end, periodType));
    }

    /**
     * gai2 W5 — /energy/by-space：按空间层级下钻聚合（A3 MVP2）。
     * type=BUILDING 时取所有顶级建筑；type=FLOOR/ROOM 时取 parentId 子树内同 type 节点。
     */
    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/by-space")
    public Result<List<Map<String, Object>>> bySpace(
            @RequestParam String type,
            @RequestParam(required = false) Long parentId,
            @RequestParam(required = false) String periodType,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        LocationType lt = LocationType.of(type);
        if (lt == null) {
            return Result.error("空间类型无效: " + type);
        }
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : null;
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : null;
        return Result.success(energyService.aggregateBySpace(lt, parentId, periodType, start, end));
    }

    // ── gai2 W25 step2 权威化端点（A3 增强 4） ────────────────────────────────

    /**
     * 同环比对比（替换前端 trendChange 客户端算法 — R8 根治）。
     * 返回 {current, previous, changeRate, currentTotal, previousTotal}。
     */
    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/compare")
    public Result<Map<String, Object>> compare(
            @RequestParam String currentStart,
            @RequestParam String currentEnd,
            @RequestParam String previousStart,
            @RequestParam String previousEnd,
            @RequestParam(required = false) String periodType) {
        return Result.success(energyService.compareRange(
                LocalDate.parse(currentStart), LocalDate.parse(currentEnd),
                LocalDate.parse(previousStart), LocalDate.parse(previousEnd),
                periodType));
    }

    /**
     * 跨维度排名（scope: asset|building|floor|area；limit 默认 10）。
     */
    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/ranking")
    public Result<List<Map<String, Object>>> ranking(
            @RequestParam String scope,
            @RequestParam(required = false) String periodType,
            @RequestParam(required = false) String meterType,
            @RequestParam(required = false) Integer limit) {
        return Result.success(energyService.rankingByScope(scope, periodType, meterType, limit));
    }

    /**
     * 异常检测（替换前端 detectAnomalies 客户端 z-score — R8 根治）。
     * method=zscore|stddev；threshold 单位 σ（默认 1.5）。
     */
    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/anomalies")
    public Result<List<Map<String, Object>>> anomalies(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) String periodType,
            @RequestParam(required = false) String method,
            @RequestParam(required = false) Double threshold) {
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : LocalDate.now();
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : end.minusMonths(12);
        return Result.success(energyService.detectAnomaliesAuthority(start, end, periodType, method, threshold));
    }

    /**
     * 空间下资产 + 能耗（GIS 选建筑 → 该空间下资产与能耗联动 — W32 GIS TOP 资产高亮）。
     */
    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/locations/{id}/assets")
    public Result<List<Map<String, Object>>> locationAssets(
            @PathVariable Long id,
            @RequestParam(required = false) String periodType,
            @RequestParam(required = false) Boolean withEnergy) {
        return Result.success(energyService.getLocationAssetsWithEnergy(id, periodType, withEnergy));
    }
}
