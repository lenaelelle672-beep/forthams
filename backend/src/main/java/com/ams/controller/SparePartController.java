package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.SparePart;
import com.ams.service.SparePartService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/spare-parts")
@RequiredArgsConstructor
public class SparePartController {

    private final SparePartService sparePartService;

    @PreAuthorize("@ss.hasPermi('inventory:sparepart:query')")
    @GetMapping
    public Result<Page<SparePart>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword) {
        return Result.success(sparePartService.list(page, pageSize, keyword));
    }

    @PreAuthorize("@ss.hasPermi('inventory:sparepart:query')")
    @GetMapping("/{id}")
    public Result<SparePart> getById(@PathVariable Long id) {
        return Result.success(sparePartService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('inventory:sparepart:create')")
    @PostMapping
    public Result<SparePart> create(@RequestBody SparePart sparePart) {
        return Result.success(sparePartService.create(sparePart));
    }

    @PreAuthorize("@ss.hasPermi('inventory:sparepart:edit')")
    @PutMapping("/{id}")
    public Result<SparePart> update(@PathVariable Long id, @RequestBody SparePart sparePart) {
        return Result.success(sparePartService.update(id, sparePart));
    }

    @PreAuthorize("@ss.hasPermi('inventory:sparepart:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        sparePartService.delete(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('inventory:sparepart:query')")
    @GetMapping("/low-stock")
    public Result<List<SparePart>> getLowStockAlerts() {
        return Result.success(sparePartService.getLowStockAlerts());
    }

    @PreAuthorize("@ss.hasPermi('inventory:sparepart:query')")
    @GetMapping("/purchase-suggestions")
    public Result<List<Map<String, Object>>> getPurchaseSuggestions() {
        return Result.success(sparePartService.getPurchaseSuggestions());
    }

    @PreAuthorize("@ss.hasPermi('inventory:sparepart:query')")
    @GetMapping("/{id}/usages")
    public Result<List<SparePartUsageResponse>> getUsageBySparePart(@PathVariable Long id) {
        return Result.success(sparePartService.getUsageBySparePart(id).stream()
                .map(u -> new SparePartUsageResponse(u.getId(), u.getSparePartId(), u.getWorkOrderId(),
                        u.getQuantity(), u.getUsageDate(), u.getUserId(), u.getNote()))
                .toList());
    }

    @PreAuthorize("@ss.hasPermi('inventory:sparepart:query')")
    @GetMapping("/by-work-order/{workOrderId}")
    public Result<List<SparePartUsageResponse>> getUsageByWorkOrder(@PathVariable Long workOrderId) {
        return Result.success(sparePartService.getUsageByWorkOrder(workOrderId).stream()
                .map(u -> new SparePartUsageResponse(u.getId(), u.getSparePartId(), u.getWorkOrderId(),
                        u.getQuantity(), u.getUsageDate(), u.getUserId(), u.getNote()))
                .toList());
    }

    // 简单的响应 DTO
    public record SparePartUsageResponse(
            Long id, Long sparePartId, Long workOrderId,
            java.math.BigDecimal quantity, java.time.LocalDateTime usageDate,
            Long userId, String note) {}
}
