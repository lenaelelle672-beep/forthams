package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.AssetValueTrendDTO;
import com.ams.dto.DashboardStatsDTO;
import com.ams.dto.DeptAssetDistributionDTO;
import com.ams.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/stats")
    public Result<DashboardStatsDTO> getStats() {
        return Result.success(dashboardService.getStats());
    }

    @GetMapping("/trends")
    public Result<List<AssetValueTrendDTO>> getValueTrends(
            @RequestParam(defaultValue = "30") Integer days) {
        return Result.success(dashboardService.getValueTrends(days));
    }

    @GetMapping("/dept-distribution")
    public Result<List<DeptAssetDistributionDTO>> getDeptDistribution() {
        return Result.success(dashboardService.getDeptDistribution());
    }

    @GetMapping("/maintenance-stats")
    public Result<Map<String, Object>> getMaintenanceStats() {
        return Result.success(dashboardService.getMaintenanceStats());
    }

    @GetMapping("/pending-approvals")
    public Result<Long> getPendingApprovals() {
        return Result.success(dashboardService.getPendingApprovals());
    }
}
