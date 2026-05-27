package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.DashboardStatsDTO;
import com.ams.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/bigscreen")
@RequiredArgsConstructor
public class BigScreenController {

    private final DashboardService dashboardService;

    @PreAuthorize("@ss.hasPermi('bigscreen:query')")
    @GetMapping("/stats")
    public Result<DashboardStatsDTO> getStats() {
        return Result.success(dashboardService.getGlobalStats());
    }
}
