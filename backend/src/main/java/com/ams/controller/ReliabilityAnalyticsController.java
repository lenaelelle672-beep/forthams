package com.ams.controller;

import com.ams.common.Result;
import com.ams.service.ReliabilityAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/reliability")
@RequiredArgsConstructor
public class ReliabilityAnalyticsController {

    private final ReliabilityAnalyticsService reliabilityAnalyticsService;

    @PreAuthorize("@ss.hasPermi('analytics:reliability:query')")
    @GetMapping("/summary")
    public Result<Map<String, Object>> getSummary(
            @RequestParam(required = false) Long assetId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        LocalDateTime start = startDate != null ? LocalDateTime.parse(startDate + "T00:00:00") : null;
        LocalDateTime end = endDate != null ? LocalDateTime.parse(endDate + "T23:59:59") : null;
        return Result.success(reliabilityAnalyticsService.getSummary(assetId, start, end));
    }

    @PreAuthorize("@ss.hasPermi('analytics:reliability:query')")
    @GetMapping("/trend")
    public Result<List<Map<String, Object>>> getTrend(
            @RequestParam(defaultValue = "MONTH") String period,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        LocalDateTime start = startDate != null ? LocalDateTime.parse(startDate + "T00:00:00") : null;
        LocalDateTime end = endDate != null ? LocalDateTime.parse(endDate + "T23:59:59") : null;
        return Result.success(reliabilityAnalyticsService.getTrend(period, start, end));
    }

    @PreAuthorize("@ss.hasPermi('analytics:reliability:query')")
    @GetMapping("/ranking")
    public Result<List<Map<String, Object>>> getRanking(
            @RequestParam(defaultValue = "MTBF") String sortBy,
            @RequestParam(defaultValue = "10") Integer limit) {
        return Result.success(reliabilityAnalyticsService.getRanking(sortBy, limit));
    }

    @PreAuthorize("@ss.hasPermi('analytics:reliability:query')")
    @GetMapping("/asset/{assetId}")
    public Result<Map<String, Object>> getByAsset(@PathVariable Long assetId) {
        Map<String, Object> summary = reliabilityAnalyticsService.getSummary(assetId, null, null);
        summary.put("trends", reliabilityAnalyticsService.getTrend("MONTH", null, null));
        return Result.success(summary);
    }
}
