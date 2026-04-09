package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.InventoryScanDTO;
import com.ams.dto.InventoryTaskCreateDTO;
import com.ams.entity.InventoryDetail;
import com.ams.entity.InventoryTask;
import com.ams.service.InventoryService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @GetMapping("/tasks")
    public Result<Page<InventoryTask>> queryTasks(
        @RequestParam(defaultValue = "1") Integer page,
        @RequestParam(defaultValue = "10") Integer pageSize,
        @RequestParam(required = false) String status
    ) {
        return Result.success(inventoryService.queryTasks(page, pageSize, status));
    }

    @GetMapping("/tasks/{id}")
    public Result<Map<String, Object>> getTaskById(@PathVariable Long id) {
        return Result.success(inventoryService.getTaskById(id));
    }

    @PostMapping("/tasks")
    public Result<InventoryTask> createTask(@Valid @RequestBody InventoryTaskCreateDTO createDTO) {
        return Result.success("创建成功", inventoryService.createTask(createDTO));
    }

    @PutMapping("/tasks/{id}/status")
    public Result<InventoryTask> updateTaskStatus(@PathVariable Long id, @RequestParam String status) {
        return Result.success("更新成功", inventoryService.updateTaskStatus(id, status));
    }

    @PostMapping("/tasks/{id}/scan")
    public Result<InventoryDetail> addScanResult(@PathVariable Long id, @RequestBody InventoryScanDTO scanDTO) {
        return Result.success("扫描成功", inventoryService.addScanResult(id, scanDTO));
    }

    @GetMapping("/tasks/{id}/details")
    public Result<List<InventoryDetail>> getTaskDetails(@PathVariable Long id) {
        return Result.success(inventoryService.getTaskDetails(id));
    }
}
