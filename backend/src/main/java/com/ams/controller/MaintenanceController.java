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

    @GetMapping("/{id}")
    public Result<MaintenanceRecord> getById(@PathVariable Long id) {
        return Result.success(maintenanceService.getRecordById(id));
    }

    @PostMapping
    public Result<MaintenanceRecord> create(@RequestBody Object dto) {
        return Result.success(maintenanceService.createRecord(null));
    }

    @PutMapping("/{id}")
    public Result<MaintenanceRecord> update(@PathVariable Long id, @RequestBody Object dto) {
        return Result.success(maintenanceService.updateRecord(id, null));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        maintenanceService.deleteRecord(id);
        return Result.success();
    }
}
