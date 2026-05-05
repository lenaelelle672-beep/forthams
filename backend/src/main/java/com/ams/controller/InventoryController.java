package com.ams.controller;

import com.ams.dto.InventoryTaskCreateDTO;
import com.ams.dto.InventoryScanDTO;
import com.ams.entity.InventoryTask;
import com.ams.entity.InventoryDetail;
import com.ams.service.InventoryService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping("/tasks")
    public Result<Page<InventoryTask>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status) {
        return Result.success(inventoryService.queryTasks(page, pageSize, status));
    }

    @GetMapping("/tasks/{id}")
    public Result<?> getById(@PathVariable Long id) {
        return Result.success(inventoryService.getTaskById(id));
    }

    @GetMapping("/tasks/{id}/details")
    public Result<List<InventoryDetail>> getDetails(@PathVariable Long id) {
        return Result.success(inventoryService.getTaskDetails(id));
    }

    @PostMapping("/tasks")
    public Result<InventoryTask> create(@RequestBody InventoryTaskCreateDTO dto) {
        return Result.success(inventoryService.createTask(dto));
    }

    @PutMapping("/tasks/{id}/status")
    public Result<InventoryTask> updateStatus(@PathVariable Long id, @RequestBody java.util.Map<String, String> body) {
        return Result.success(inventoryService.updateTaskStatus(id, body.get("status")));
    }

    @PostMapping("/tasks/{id}/scan")
    public Result<InventoryDetail> scan(@PathVariable Long id, @RequestBody InventoryScanDTO dto) {
        return Result.success(inventoryService.addScanResult(id, dto));
    }
}
