package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.Asset;
import com.ams.entity.AssetDepreciation;
import com.ams.entity.DepreciationRecord;
import com.ams.service.AssetService;
import com.ams.service.DepreciationService;
import com.ams.service.impl.DepreciationCalculator;
import com.ams.service.impl.DoubleDecliningBalanceDepreciation;
import com.ams.service.impl.StraightLineDepreciation;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * 资产折旧计算控制器
 * 
 * 功能说明：
 * - 支持直线法折旧计算
 * - 支持双倍余额递减法折旧计算
 * - 生成月度折旧计划表
 * - 生成年度折旧汇总报表
 * 
 * @author AMS Team
 * @version 1.0
 */
@RestController
@RequestMapping("/api/v1/depreciation")
@RequiredArgsConstructor
public class DepreciationController {

    private final DepreciationService depreciationService;
    private final AssetService assetService;
    private final DepreciationCalculator depreciationCalculator;
    private final StraightLineDepreciation straightLineDepreciation;
    private final DoubleDecliningBalanceDepreciation doubleDecliningBalanceDepreciation;

    /**
     * 计算单个资产的折旧
     * 
     * @param assetId 资产ID
     * @param method 折旧方法: straight_line 或 double_declining_balance
     * @return 折旧计算结果
     */
    @PostMapping("/calculate/{assetId}")
    public ResponseEntity<Result<Map<String, Object>>> calculateDepreciation(
            @PathVariable Long assetId,
            @RequestParam(defaultValue = "straight_line") String method) {
        
        Asset asset = assetService.getById(assetId);
        if (asset == null) {
            return ResponseEntity.badRequest()
                    .body(Result.error("Asset not found with id: " + assetId));
        }

        // 验证折旧方法
        if (!isValidDepreciationMethod(method)) {
            return ResponseEntity.badRequest()
                    .body(Result.error("Invalid depreciation method: " + method));
        }

        // 执行折旧计算
        List<Map<String, Object>> schedule = depreciationCalculator.calculate(
                asset, method);

        Map<String, Object> result = new HashMap<>();
        result.put("assetId", assetId);
        result.put("assetName", asset.getName());
        result.put("method", method);
        result.put("originalValue", asset.getOriginalValue());
        result.put("salvageValue", asset.getSalvageValue());
        result.put("usefulLifeYears", asset.getUsefulLifeYears());
        result.put("depreciationSchedule", schedule);
        
        // 计算总折旧金额
        BigDecimal totalDepreciation = BigDecimal.ZERO;
        for (Map<String, Object> period : schedule) {
            Object dep = period.get("depreciation");
            if (dep instanceof BigDecimal) {
                totalDepreciation = totalDepreciation.add((BigDecimal) dep);
            }
        }
        result.put("totalDepreciation", totalDepreciation);

        return ResponseEntity.ok(Result.success(result));
    }

    /**
     * 批量计算多个资产的折旧
     * 
     * @param assetIds 资产ID列表
     * @param method 折旧方法
     * @return 批量折旧计算结果
     */
    @PostMapping("/calculate/batch")
    public ResponseEntity<Result<List<Map<String, Object>>>> calculateBatchDepreciation(
            @RequestBody List<Long> assetIds,
            @RequestParam(defaultValue = "straight_line") String method) {
        
        if (assetIds == null || assetIds.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Result.error("Asset IDs cannot be empty"));
        }

        // 限制批量处理数量
        if (assetIds.size() > 1000) {
            return ResponseEntity.badRequest()
                    .body(Result.error("Batch size exceeds maximum limit of 1000"));
        }

        List<Map<String, Object>> results = new ArrayList<>();
        for (Long assetId : assetIds) {
            try {
                Asset asset = assetService.getById(assetId);
                if (asset != null) {
                    List<Map<String, Object>> schedule = depreciationCalculator.calculate(
                            asset, method);
                    
                    Map<String, Object> result = new HashMap<>();
                    result.put("assetId", assetId);
                    result.put("assetName", asset.getName());
                    result.put("method", method);
                    result.put("depreciationSchedule", schedule);
                    results.add(result);
                }
            } catch (Exception e) {
                Map<String, Object> errorResult = new HashMap<>();
                errorResult.put("assetId", assetId);
                errorResult.put("error", e.getMessage());
                results.add(errorResult);
            }
        }

        return ResponseEntity.ok(Result.success(results));
    }

    /**
     * 获取月度折旧计划表
     * 
     * @param assetId 资产ID
     * @param year 年份
     * @param method 折旧方法
     * @return 月度折旧计划列表
     */
    @GetMapping("/schedule/monthly/{assetId}")
    public ResponseEntity<Result<List<Map<String, Object>>>> getMonthlySchedule(
            @PathVariable Long assetId,
            @RequestParam Integer year,
            @RequestParam(defaultValue = "straight_line") String method) {
        
        Asset asset = assetService.getById(assetId);
        if (asset == null) {
            return ResponseEntity.badRequest()
                    .body(Result.error("Asset not found with id: " + assetId));
        }

        List<Map<String, Object>> monthlySchedule = depreciationService
                .generateMonthlySchedule(asset, year, method);

        return ResponseEntity.ok(Result.success(monthlySchedule));
    }

    /**
     * 获取年度折旧汇总报表
     * 
     * @param year 年份
     * @param categoryId 资产类别ID（可选，用于按类别聚合）
     * @return 年度折旧汇总数据
     */
    @GetMapping("/report/annual")
    public ResponseEntity<Result<Map<String, Object>>> getAnnualReport(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate year,
            @RequestParam(required = false) Long categoryId) {
        
        Map<String, Object> report = depreciationService.generateAnnualReport(
                year.getYear(), categoryId);

        return ResponseEntity.ok(Result.success(report));
    }

    /**
     * 获取折旧记录列表
     * 
     * @param assetId 资产ID（可选）
     * @param startDate 开始日期（可选）
     * @param endDate 结束日期（可选）
     * @return 折旧记录列表
     */
    @GetMapping("/records")
    public ResponseEntity<Result<Map<String, Object>>> getDepreciationRecords(
            @RequestParam(required = false) Long assetId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        
        List<DepreciationRecord> records = depreciationService.getRecords(
                assetId, startDate, endDate);

        Map<String, Object> result = new HashMap<>();
        result.put("total", records.size());
        result.put("records", records);

        return ResponseEntity.ok(Result.success(result));
    }

    /**
     * 触发折旧计算任务（用于定时任务或手动触发）
     * 
     * @param year 年份
     * @param month 月份
     * @return 触发结果
     */
    @PostMapping("/trigger")
    public ResponseEntity<Result<Map<String, Object>>> triggerDepreciation(
            @RequestParam Integer year,
            @RequestParam Integer month) {
        
        // 验证日期不是未来期间
        LocalDate now = LocalDate.now();
        LocalDate targetDate = LocalDate.of(year, month, 1);
        if (targetDate.isAfter(now)) {
            return ResponseEntity.badRequest()
                    .body(Result.error("Cannot calculate depreciation for future periods"));
        }

        Map<String, Object> triggerResult = depreciationService.triggerDepreciation(year, month);

        return ResponseEntity.ok(Result.success(triggerResult));
    }

    /**
     * 获取资产折旧摘要
     * 
     * @param assetId 资产ID
     * @return 折旧摘要信息
     */
    @GetMapping("/summary/{assetId}")
    public ResponseEntity<Result<Map<String, Object>>> getDepreciationSummary(
            @PathVariable Long assetId) {
        
        Asset asset = assetService.getById(assetId);
        if (asset == null) {
            return ResponseEntity.badRequest()
                    .body(Result.error("Asset not found with id: " + assetId));
        }

        Map<String, Object> summary = depreciationService.getDepreciationSummary(assetId);

        return ResponseEntity.ok(Result.success(summary));
    }

    /**
     * 验证折旧方法是否有效
     * 
     * @param method 折旧方法
     * @return 是否有效
     */
    private boolean isValidDepreciationMethod(String method) {
        return "straight_line".equals(method) || "double_declining_balance".equals(method);
    }
}