package com.ams.controller;

import com.ams.dto.MaintenancePlanCreateDTO;
import com.ams.dto.MaintenancePlanQueryDTO;
import com.ams.dto.MaintenancePlanUpdateDTO;
import com.ams.entity.MaintenancePlan;
import com.ams.service.MaintenancePlanService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/maintenance/plans")
@RequiredArgsConstructor
public class MaintenancePlanController {

    private final MaintenancePlanService maintenancePlanService;

    @PreAuthorize("@ss.hasPermi('asset:maintenance:query')")
    @GetMapping
    public Result<Page<MaintenancePlan>> list(@Valid MaintenancePlanQueryDTO dto) {
        return Result.success(maintenancePlanService.queryPlans(dto));
    }

    @PreAuthorize("@ss.hasPermi('asset:maintenance:query')")
    @GetMapping("/{id}")
    public Result<MaintenancePlan> getById(@PathVariable Long id) {
        return Result.success(maintenancePlanService.getPlanById(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:maintenance:create')")
    @PostMapping
    public Result<MaintenancePlan> create(@Valid @RequestBody MaintenancePlanCreateDTO dto) {
        return Result.success(maintenancePlanService.createPlan(dto));
    }

    @PreAuthorize("@ss.hasPermi('asset:maintenance:edit')")
    @PutMapping("/{id}")
    public Result<MaintenancePlan> update(@PathVariable Long id, @Valid @RequestBody MaintenancePlanUpdateDTO dto) {
        return Result.success(maintenancePlanService.updatePlan(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('asset:maintenance:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        maintenancePlanService.deletePlan(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('asset:maintenance:create')")
    @PostMapping("/{id}/generate")
    public Result<Void> generateRecord(@PathVariable Long id) {
        maintenancePlanService.triggerGenerate(id);
        return Result.success();
    }
}
