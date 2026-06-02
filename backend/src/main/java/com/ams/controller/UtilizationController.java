package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.AssetUtilizationDTO;
import com.ams.dto.UtilizationOverviewDTO;
import com.ams.dto.UtilizationSummaryDTO;
import com.ams.dto.UtilizationTrendDTO;
import com.ams.service.UtilizationService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/stats/utilization")
@RequiredArgsConstructor
public class UtilizationController {

    private final UtilizationService utilizationService;

    @PreAuthorize("@ss.hasPermi('stats:query')")
    @GetMapping("/overview")
    public Result<UtilizationOverviewDTO> getOverview(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : LocalDate.now();
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : end.minusMonths(1);
        return Result.success(utilizationService.getOverview(start, end));
    }

    @PreAuthorize("@ss.hasPermi('stats:query')")
    @GetMapping("/asset/{assetId}")
    public Result<AssetUtilizationDTO> getAssetUtilization(
            @PathVariable Long assetId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : LocalDate.now();
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : end.minusMonths(1);
        AssetUtilizationDTO dto = AssetUtilizationDTO.builder()
                .assetId(assetId)
                .utilizationRate(utilizationService.calculateUtilization(assetId, start, end))
                .build();
        return Result.success(dto);
    }

    @PreAuthorize("@ss.hasPermi('stats:query')")
    @GetMapping("/asset/{assetId}/trend")
    public Result<List<UtilizationTrendDTO>> getUtilizationTrend(
            @PathVariable Long assetId,
            @RequestParam(defaultValue = "MONTHLY") String periodType,
            @RequestParam(defaultValue = "12") int months) {
        return Result.success(utilizationService.getUtilizationTrend(assetId, periodType, months));
    }

    @PreAuthorize("@ss.hasPermi('stats:query')")
    @GetMapping("/summary")
    public Result<Map<String, List<UtilizationSummaryDTO>>> getSummary(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : LocalDate.now();
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : end.minusMonths(1);
        Map<String, List<UtilizationSummaryDTO>> result = Map.of(
                "byCategory", utilizationService.getSummaryByCategory(start, end),
                "byDept", utilizationService.getSummaryByDept(start, end));
        return Result.success(result);
    }

    @PreAuthorize("@ss.hasPermi('stats:query')")
    @GetMapping("/top")
    public Result<List<AssetUtilizationDTO>> getTopUtilized(
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        LocalDate end = endDate != null ? LocalDate.parse(endDate) : LocalDate.now();
        LocalDate start = startDate != null ? LocalDate.parse(startDate) : end.minusMonths(1);
        return Result.success(utilizationService.getTopUtilizedAssets(limit, start, end));
    }

    @PreAuthorize("@ss.hasPermi('stats:query')")
    @GetMapping("/idle")
    public Result<List<AssetUtilizationDTO>> getIdleAssets(
            @RequestParam(defaultValue = "30") int days) {
        return Result.success(utilizationService.getIdleAssets(days));
    }

    @PreAuthorize("@ss.hasPermi('stats:query')")
    @PostMapping("/calculate")
    public Result<Void> calculateSnapshots() {
        utilizationService.calculateMonthlySnapshot();
        return Result.success();
    }

}
