package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.SamComplianceScan;
import com.ams.service.SamComplianceService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/sam")
@RequiredArgsConstructor
public class SamComplianceController {

    private final SamComplianceService samComplianceService;

    @PreAuthorize("@ss.hasPermi('license:create')")
    @PostMapping("/scan")
    public Result<SamComplianceScan> runScan() {
        return Result.success(samComplianceService.runScan());
    }

    @PreAuthorize("@ss.hasPermi('license:query')")
    @GetMapping("/latest")
    public Result<Map<String, Object>> latest() {
        return Result.success(samComplianceService.getLatestScan());
    }

    @PreAuthorize("@ss.hasPermi('license:query')")
    @GetMapping("/history")
    public Result<Page<SamComplianceScan>> history(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(samComplianceService.getScanHistory(page, pageSize));
    }

    @PreAuthorize("@ss.hasPermi('license:query')")
    @GetMapping("/{scanId}/details")
    public Result<Map<String, Object>> details(@PathVariable Long scanId) {
        return Result.success(samComplianceService.getScanDetails(scanId));
    }

    @PreAuthorize("@ss.hasPermi('license:query')")
    @GetMapping("/dashboard")
    public Result<Map<String, Object>> dashboard() {
        return Result.success(samComplianceService.getDashboardData());
    }
}
