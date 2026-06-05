package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.CategoryReportDTO;
import com.ams.dto.ReportMonthlyDTO;
import com.ams.dto.ReportSummaryDTO;
import com.ams.dto.ReportTrendDTO;
import com.ams.service.PdfExportService;
import com.ams.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;
import java.util.Map;

/**
 * 资产报表控制器。
 *
 * <p>提供资产汇总统计、分类统计、趋势数据以及月度统计（折旧/维保/退役处置）API。
 * <ul>
 *   <li>RPT-01: GET /api/reports/summary — 资产汇总统计</li>
 *   <li>RPT-02: GET /api/reports/by-category — 按分类统计</li>
 *   <li>RPT-03: GET /api/reports/trend — 月度趋势</li>
 *   <li>RPT-04: GET /api/reports/depreciation-stats — 折旧月度统计</li>
 *   <li>RPT-05: GET /api/reports/maintenance-stats — 维保月度统计</li>
 *   <li>RPT-06: GET /api/reports/retirement-stats — 退役处置月度统计</li>
 * </ul>
 */
@RestController
@RequestMapping("/reports")
@RequiredArgsConstructor
@Tag(name = "报表中心", description = "资产报表统计与 PDF 导出")
public class ReportController {

    private final ReportService reportService;
    private final PdfExportService pdfExportService;

    /**
     * RPT-01: 获取资产汇总统计。
     *
     * @return 汇总数据（totalAssets, activeAssets, pendingApproval, recentlyRetired）
     */
    @PreAuthorize("@ss.hasPermi('report:query')")
    @GetMapping("/summary")
    public Result<ReportSummaryDTO> getSummary() {
        return Result.success(reportService.getSummary());
    }

    /**
     * RPT-02: 获取按分类统计的资产数据。
     *
     * @return 分类统计列表
     */
    @PreAuthorize("@ss.hasPermi('report:query')")
    @GetMapping("/by-category")
    public Result<List<CategoryReportDTO>> getByCategory() {
        return Result.success(reportService.getByCategory());
    }

    /**
     * RPT-03: 获取资产月度趋势数据。
     *
     * @return 近 12 个月的趋势数据（总价值 + 净值）
     */
    @PreAuthorize("@ss.hasPermi('report:query')")
    @GetMapping("/trend")
    public Result<List<ReportTrendDTO>> getTrend() {
        return Result.success(reportService.getTrend());
    }

    /**
     * RPT-04: 获取折旧月度统计。
     *
     * @return 月度折旧金额列表（最近 12 个月）
     */
    @PreAuthorize("@ss.hasPermi('report:query')")
    @GetMapping("/depreciation-stats")
    public Result<List<ReportMonthlyDTO>> getDepreciationStats() {
        return Result.success(reportService.getDepreciationStats());
    }

    /**
     * RPT-05: 获取维保月度统计。
     *
     * @return 月度维保次数列表（最近 12 个月）
     */
    @PreAuthorize("@ss.hasPermi('report:query')")
    @GetMapping("/maintenance-stats")
    public Result<List<ReportMonthlyDTO>> getMaintenanceStats() {
        return Result.success(reportService.getMaintenanceStats());
    }

    /**
     * RPT-06: 获取退役处置月度统计。
     *
     * @return 月度退役处置数量列表（最近 12 个月）
     */
    @PreAuthorize("@ss.hasPermi('report:query')")
    @GetMapping("/retirement-stats")
    public Result<List<ReportMonthlyDTO>> getRetirementStats() {
        return Result.success(reportService.getRetirementStats());
    }

    @Operation(summary = "导出 PDF 报表", description = "按类型导出报表为 PDF，支持 summary/category/trend 等类型")
    @PreAuthorize("@ss.hasPermi('report:export')")
    @PostMapping("/{type}/export-pdf")
    public ResponseEntity<byte[]> exportPdf(
            @PathVariable String type,
            @RequestBody(required = false) Map<String, Object> params) {
        byte[] pdfBytes = pdfExportService.exportReport(type + "-report", params);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", type + "-report.pdf");
        return ResponseEntity.ok().headers(headers).body(pdfBytes);
    }
}
