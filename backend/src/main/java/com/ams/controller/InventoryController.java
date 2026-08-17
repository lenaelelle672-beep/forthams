package com.ams.controller;

import com.ams.dto.InventoryTaskCreateDTO;
import com.ams.dto.InventoryScanDTO;
import com.ams.dto.InventoryTaskStatusUpdateDTO;
import com.ams.entity.InventoryTask;
import com.ams.entity.InventoryDetail;
import com.ams.service.InventoryService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/inventory")
@RequiredArgsConstructor
@Validated
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping("/tasks")
    @PreAuthorize("hasAuthority('inventory:query')")
    public Result<Page<InventoryTask>> list(
            @RequestParam(defaultValue = "1") @Min(value = 1, message = "页码必须大于0") Integer page,
            @RequestParam(defaultValue = "10") @Min(value = 1, message = "每页条数必须大于0") Integer pageSize,
            @RequestParam(required = false) String status) {
        return Result.success(inventoryService.queryTasks(page, pageSize, status));
    }

    @GetMapping("/tasks/{id}")
    @PreAuthorize("hasAuthority('inventory:query')")
    public Result<?> getById(@PathVariable @Positive Long id) {
        return Result.success(inventoryService.getTaskById(id));
    }

    @GetMapping("/tasks/{id}/details")
    @PreAuthorize("hasAuthority('inventory:query')")
    public Result<Page<InventoryDetail>> getDetails(
            @PathVariable @Positive Long id,
            @RequestParam(defaultValue = "1") @Min(value = 1, message = "页码必须大于0") Integer page,
            @RequestParam(defaultValue = "50") @Min(value = 1, message = "每页条数必须大于0") Integer pageSize) {
        return Result.success(inventoryService.getTaskDetails(id, page, pageSize));
    }

    @PostMapping("/tasks")
    @PreAuthorize("hasAuthority('inventory:create')")
    public Result<InventoryTask> create(@Valid @RequestBody InventoryTaskCreateDTO dto) {
        return Result.success(inventoryService.createTask(dto));
    }

    @PutMapping("/tasks/{id}/status")
    @PreAuthorize("hasAuthority('inventory:update')")
    public Result<InventoryTask> updateStatus(@PathVariable @Positive Long id,
                                               @Valid @RequestBody InventoryTaskStatusUpdateDTO body) {
        return Result.success(inventoryService.updateTaskStatus(id, body.getStatus()));
    }

    @PostMapping("/tasks/{id}/scan")
    @PreAuthorize("hasAuthority('inventory:scan')")
    public Result<InventoryDetail> scan(@PathVariable @Positive Long id, @Valid @RequestBody InventoryScanDTO dto) {
        return Result.success(inventoryService.addScanResult(id, dto));
    }
}
