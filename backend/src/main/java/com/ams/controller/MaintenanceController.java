package com.ams.controller;

import com.ams.dto.MaintenanceCreateDTO;
import com.ams.dto.MaintenanceUpdateDTO;
import com.ams.entity.MaintenanceRecord;
import com.ams.service.MaintenanceService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
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
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(maintenanceService.queryRecords(page, pageSize, null, null));
    }

    @GetMapping("/{id}")
    public Result<MaintenanceRecord> getById(@PathVariable Long id) {
        return Result.success(maintenanceService.getRecordById(id));
    }

    @GetMapping("/upcoming")
    public Result<?> upcoming(@RequestParam(defaultValue = "30") Integer days) {
        return Result.success(maintenanceService.getUpcomingMaintenance(days));
    }

    @PostMapping
    public Result<MaintenanceRecord> create(@RequestBody MaintenanceCreateDTO dto) {
        return Result.success(maintenanceService.createRecord(dto));
    }

    @PutMapping("/{id}")
    public Result<MaintenanceRecord> update(@PathVariable Long id, @RequestBody MaintenanceUpdateDTO dto) {
        return Result.success(maintenanceService.updateRecord(id, dto));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        maintenanceService.deleteRecord(id);
        return Result.success();
    }
}
