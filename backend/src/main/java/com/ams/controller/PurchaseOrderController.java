package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.PurchaseOrderCreateDTO;
import com.ams.dto.PurchaseOrderUpdateDTO;
import com.ams.entity.PurchaseOrder;
import com.ams.entity.PurchaseOrderItem;
import com.ams.service.PurchaseOrderService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/purchase-orders")
@RequiredArgsConstructor
public class PurchaseOrderController {

    private final PurchaseOrderService purchaseOrderService;

    @PreAuthorize("@ss.hasPermi('purchase:order:query')")
    @GetMapping
    public Result<Page<PurchaseOrder>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String orderNo,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long vendorId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        return Result.success(purchaseOrderService.getPage(page, pageSize, keyword, orderNo, status, vendorId, startDate, endDate));
    }

    @PreAuthorize("@ss.hasPermi('purchase:order:query')")
    @GetMapping("/{id}")
    public Result<Map<String, Object>> getById(@PathVariable Long id) {
        return Result.success(purchaseOrderService.getDetail(id));
    }

    @PreAuthorize("@ss.hasPermi('purchase:order:query')")
    @GetMapping("/{id}/items")
    public Result<List<PurchaseOrderItem>> getItems(@PathVariable Long id) {
        return Result.success(purchaseOrderService.getItemsByOrderId(id));
    }

    @PreAuthorize("@ss.hasPermi('purchase:order:add')")
    @PostMapping
    public Result<PurchaseOrder> create(@Valid @RequestBody PurchaseOrderCreateDTO dto) {
        return Result.success(purchaseOrderService.create(dto));
    }

    @PreAuthorize("@ss.hasPermi('purchase:order:edit')")
    @PutMapping("/{id}")
    public Result<PurchaseOrder> update(@PathVariable Long id, @Valid @RequestBody PurchaseOrderUpdateDTO dto) {
        return Result.success(purchaseOrderService.update(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('purchase:order:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        purchaseOrderService.delete(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('purchase:order:edit')")
    @PostMapping("/{id}/submit")
    public Result<PurchaseOrder> submit(@PathVariable Long id) {
        return Result.success(purchaseOrderService.submit(id));
    }

    @PreAuthorize("@ss.hasPermi('purchase:order:edit')")
    @PostMapping("/{id}/approve")
    public Result<PurchaseOrder> approve(@PathVariable Long id) {
        return Result.success(purchaseOrderService.approve(id));
    }

    @PreAuthorize("@ss.hasPermi('purchase:order:edit')")
    @PostMapping("/{id}/receive")
    public Result<PurchaseOrder> receive(@PathVariable Long id) {
        return Result.success(purchaseOrderService.receive(id));
    }

    @PreAuthorize("@ss.hasPermi('purchase:order:edit')")
    @PostMapping("/{id}/cancel")
    public Result<PurchaseOrder> cancel(@PathVariable Long id) {
        return Result.success(purchaseOrderService.cancel(id));
    }

    @PreAuthorize("@ss.hasPermi('purchase:order:query')")
    @GetMapping("/stats")
    public Result<Map<String, Object>> stats() {
        return Result.success(purchaseOrderService.getStats());
    }
}
