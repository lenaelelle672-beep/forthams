package com.ams.controller;

import com.ams.dto.MaintenanceCreateDTO;
import com.ams.dto.MaintenanceUpdateDTO;
import com.ams.entity.MaintenanceRecord;
import com.ams.service.MaintenanceService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import jakarta.validation.constraints.Positive;

@RestController
@RequestMapping("/maintenance")
@RequiredArgsConstructor
@Validated
public class MaintenanceController {

    private final MaintenanceService maintenanceService;

    @GetMapping("/list")
    @PreAuthorize("hasAuthority('maintenance:query')")
    public Result<Page<MaintenanceRecord>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(maintenanceService.queryRecords(page, pageSize, null, null));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('maintenance:query')")
    public Result<MaintenanceRecord> getById(@PathVariable @Positive Long id) {
        return Result.success(maintenanceService.getRecordById(id));
    }

    @GetMapping("/upcoming")
    @PreAuthorize("hasAuthority('maintenance:query')")
    public Result<?> upcoming() {
        return Result.success(maintenanceService.getUpcomingMaintenance(30));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('maintenance:create')")
    @ResponseStatus(HttpStatus.CREATED)
    public Result<MaintenanceRecord> create(@Valid @RequestBody MaintenanceCreateDTO dto) {
        return Result.success(maintenanceService.createRecord(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('maintenance:update')")
    public Result<MaintenanceRecord> update(@PathVariable @Positive Long id, @Valid @RequestBody MaintenanceUpdateDTO dto) {
        return Result.success(maintenanceService.updateRecord(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('maintenance:delete')")
    public Result<Void> delete(@PathVariable @Positive Long id) {
        maintenanceService.deleteRecord(id);
        return Result.success();
    }
}
