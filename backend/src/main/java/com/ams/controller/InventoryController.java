package com.ams.controller;

import com.ams.dto.InventoryTaskCreateDTO;
import com.ams.dto.InventoryScanDTO;
import com.ams.entity.InventoryTask;
import com.ams.entity.InventoryDetail;
import com.ams.service.InventoryService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @PreAuthorize("@ss.hasPermi('inventory:query')")
    @GetMapping("/tasks")
    public Result<Page<InventoryTask>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search) {
        return Result.success(inventoryService.queryTasks(page, pageSize, status, search));
    }

    @PreAuthorize("@ss.hasPermi('inventory:query')")
    @GetMapping("/tasks/{id}")
    public Result<?> getById(@PathVariable Long id) {
        return Result.success(inventoryService.getTaskById(id));
    }

    @PreAuthorize("@ss.hasPermi('inventory:query')")
    @GetMapping("/tasks/{id}/assets")
    public Result<Map<String, Object>> getTaskAssets(
            @PathVariable Long id,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer pageSize,
            @RequestParam(required = false) String status) {
        return Result.success(inventoryService.getTaskAssets(id, page, pageSize, status));
    }

    @PreAuthorize("@ss.hasPermi('inventory:query')")
    @GetMapping("/tasks/{id}/details")
    public Result<List<InventoryDetail>> getDetails(@PathVariable Long id) {
        return Result.success(inventoryService.getTaskDetails(id));
    }

    @PreAuthorize("@ss.hasPermi('inventory:create')")
    @PostMapping("/tasks")
    public Result<InventoryTask> create(@Valid @RequestBody InventoryTaskCreateDTO dto) {
        return Result.success(inventoryService.createTask(dto));
    }

    @PreAuthorize("@ss.hasPermi('inventory:edit')")
    @PutMapping("/tasks/{id}/status")
    public Result<InventoryTask> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return Result.success(inventoryService.updateTaskStatus(id, body.get("status")));
    }

    @PreAuthorize("@ss.hasPermi('inventory:edit')")
    @PatchMapping("/tasks/{id}/status")
    public Result<InventoryTask> patchStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return Result.success(inventoryService.updateTaskStatus(id, body.get("status")));
    }

    @PreAuthorize("@ss.hasPermi('inventory:scan')")
    @PostMapping("/tasks/{id}/scan")
    public Result<InventoryDetail> scan(@PathVariable Long id, @Valid @RequestBody InventoryScanDTO dto) {
        return Result.success(inventoryService.addScanResult(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('inventory:edit')")
    @PatchMapping("/tasks/{taskId}/assets/{detailId}/confirm")
    public Result<InventoryDetail> confirmAsset(
            @PathVariable Long taskId,
            @PathVariable Long detailId,
            @RequestBody Map<String, String> body) {
        return Result.success(inventoryService.confirmAsset(
                taskId,
                detailId,
                body.get("actualStatus"),
                body.get("remark")));
    }

    @PreAuthorize("@ss.hasPermi('inventory:edit')")
    @PostMapping("/tasks/{taskId}/assets/batch-confirm")
    public Result<Void> batchConfirmAssets(@PathVariable Long taskId, @RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<String> detailIds = ((List<?>) body.getOrDefault("assetIds", List.of())).stream()
                .map(String::valueOf)
                .toList();
        inventoryService.batchConfirmAssets(
                taskId,
                detailIds,
                String.valueOf(body.get("actualStatus")),
                body.get("remark") == null ? null : String.valueOf(body.get("remark")));
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('inventory:query')")
    @GetMapping("/tasks/{id}/summary")
    public Result<Map<String, Object>> getTaskSummary(@PathVariable Long id) {
        return Result.success(inventoryService.getTaskSummary(id));
    }

    @PreAuthorize("@ss.hasPermi('inventory:submit')")
    @PostMapping("/tasks/{id}/submit")
    public Result<InventoryTask> submitTask(@PathVariable Long id) {
        return Result.success(inventoryService.submitTask(id));
    }

    @PreAuthorize("@ss.hasPermi('inventory:submit')")
    @PostMapping("/tasks/{id}/approve")
    public Result<Map<String, Object>> approveTask(@PathVariable Long id) {
        return Result.success(inventoryService.approveTask(id));
    }

    /**
     * Batch update inventory detail records (status change for selected assets).
     * Accepts a JSON body with assetIds list and optional status/remark fields.
     */
    @PreAuthorize("@ss.hasPermi('inventory:edit')")
    @PutMapping("/assets/batch")
    public Result<Void> batchUpdateAssets(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<String> assetIds = (List<String>) body.get("assetIds");
        if (assetIds != null && !assetIds.isEmpty()) {
            String status = (String) body.get("inventoryStatus");
            inventoryService.batchUpdateDetails(assetIds, status);
        }
        return Result.success();
    }
}
