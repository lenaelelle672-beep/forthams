package com.ams.controller;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.ams.dto.AssetValueTrendDTO;
import com.ams.dto.DashboardStatsDTO;
import com.ams.dto.DeptAssetDistributionDTO;
import com.ams.service.DashboardService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
@Validated
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/stats")
    @PreAuthorize("hasAuthority('asset:query')")
    public Result<DashboardStatsDTO> getStats() {
        return Result.success(dashboardService.getStats());
    }

    @GetMapping("/trends")
    @PreAuthorize("hasAuthority('asset:query')")
    public Result<List<AssetValueTrendDTO>> getValueTrends(
            @RequestParam(defaultValue = "30")
            @Min(value = 1, message = "days必须至少为1")
            @Max(value = DashboardService.MAX_TREND_DAYS, message = "days超过允许范围") Integer days) {
        if (days == null || days < 1 || days > DashboardService.MAX_TREND_DAYS) {
            throw new BusinessException("days必须在1到" + DashboardService.MAX_TREND_DAYS + "之间");
        }
        return Result.success(dashboardService.getValueTrends(days));
    }

    @GetMapping("/dept-distribution")
    @PreAuthorize("hasAuthority('asset:query')")
    public Result<List<DeptAssetDistributionDTO>> getDeptDistribution() {
        return Result.success(dashboardService.getDeptDistribution());
    }

    @GetMapping("/maintenance-stats")
    @PreAuthorize("hasAuthority('asset:query')")
    public Result<Map<String, Object>> getMaintenanceStats() {
        return Result.success(dashboardService.getMaintenanceStats());
    }

    @GetMapping("/pending-approvals")
    @PreAuthorize("hasAuthority('asset:query')")
    public Result<Long> getPendingApprovals() {
        return Result.success(dashboardService.getPendingApprovals());
    }
}
