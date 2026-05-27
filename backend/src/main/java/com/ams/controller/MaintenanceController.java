package com.ams.controller;

import com.ams.dto.MaintenanceCreateDTO;
import com.ams.dto.MaintenanceUpdateDTO;
import com.ams.entity.MaintenanceRecord;
import com.ams.service.MaintenanceService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/maintenance")
@RequiredArgsConstructor
public class MaintenanceController {

    private final MaintenanceService maintenanceService;

    @PreAuthorize("@ss.hasPermi('asset:maintenance:query')")
    @GetMapping("/list")
    public Result<Page<MaintenanceRecord>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long assetId,
            @RequestParam(required = false) String maintenanceType) {
        return Result.success(maintenanceService.queryRecords(page, pageSize, assetId, maintenanceType));
    }

    @PreAuthorize("@ss.hasPermi('asset:maintenance:query')")
    @GetMapping("/{id}")
    public Result<MaintenanceRecord> getById(@PathVariable Long id) {
        return Result.success(maintenanceService.getRecordById(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:maintenance:query')")
    @GetMapping("/upcoming")
    public Result<?> upcoming(@RequestParam(defaultValue = "30") Integer days) {
        return Result.success(maintenanceService.getUpcomingMaintenance(days));
    }

    @PreAuthorize("@ss.hasPermi('asset:maintenance:create')")
    @PostMapping
    public Result<MaintenanceRecord> create(@Valid @RequestBody MaintenanceCreateDTO dto) {
        return Result.success(maintenanceService.createRecord(dto));
    }

    @PreAuthorize("@ss.hasPermi('asset:maintenance:edit')")
    @PutMapping("/{id}")
    public Result<MaintenanceRecord> update(@PathVariable Long id, @Valid @RequestBody MaintenanceUpdateDTO dto) {
        return Result.success(maintenanceService.updateRecord(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('asset:maintenance:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        maintenanceService.deleteRecord(id);
        return Result.success();
    }
}
