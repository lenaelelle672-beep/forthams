package com.ams.controller;

import com.ams.common.Result;
import com.ams.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 资产报表控制器
 *
 * <p>提供资产汇总统计和分类统计的 REST API。
 * <ul>
 *   <li>RPT-01: GET /api/reports/summary — 资产汇总统计</li>
 *   <li>RPT-02: GET /api/reports/by-category — 按分类统计</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    /**
     * RPT-01: 获取资产汇总统计。
     *
     * @return 汇总数据（totalAssets, activeAssets, pendingApproval, recentlyRetired）
     */
    @GetMapping("/summary")
    public Result<Map<String, Object>> getSummary() {
        return Result.success(reportService.getSummary());
    }

    /**
     * RPT-02: 获取按分类统计的资产数据。
     *
     * @return 分类统计列表
     */
    @GetMapping("/by-category")
    public Result<List<Object>> getByCategory() {
        return Result.success(reportService.getByCategory());
    }
}
