package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.MaintenanceRecord;
import com.ams.service.MaintenanceService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/maintenance")
@RequiredArgsConstructor
public class MaintenanceController {
    private final MaintenanceService maintenanceService;

    @GetMapping("/list")
    public Result<Page<MaintenanceRecord>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long assetId,
            @RequestParam(required = false) String maintenanceType) {
        return Result.success(maintenanceService.queryRecords(page, pageSize, assetId, maintenanceType));
    }
}
