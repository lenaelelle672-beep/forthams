package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.MaintenanceCreateDTO;
import com.ams.dto.MaintenanceUpdateDTO;
import com.ams.entity.MaintenanceRecord;
import com.ams.service.MaintenanceService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
        @RequestParam(required = false) String maintenanceType
    ) {
        return Result.success(maintenanceService.queryRecords(page, pageSize, assetId, maintenanceType));
    }

    @GetMapping("/{id}")
    public Result<MaintenanceRecord> getById(@PathVariable Long id) {
        return Result.success(maintenanceService.getRecordById(id));
    }

    @PostMapping
    public Result<MaintenanceRecord> create(@Valid @RequestBody MaintenanceCreateDTO createDTO) {
        return Result.success("创建成功", maintenanceService.createRecord(createDTO));
    }

    @PutMapping("/{id}")
    public Result<MaintenanceRecord> update(@PathVariable Long id, @Valid @RequestBody MaintenanceUpdateDTO updateDTO) {
        return Result.success("更新成功", maintenanceService.updateRecord(id, updateDTO));
    }

    @DeleteMapping("/{id}")
    public Result<String> delete(@PathVariable Long id) {
        maintenanceService.deleteRecord(id);
        return Result.success("删除成功");
    }

    @GetMapping("/upcoming")
    public Result<List<MaintenanceRecord>> upcoming(@RequestParam(defaultValue = "30") Integer days) {
        return Result.success(maintenanceService.getUpcomingMaintenance(days));
    }
}
