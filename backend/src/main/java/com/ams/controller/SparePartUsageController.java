package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.SparePartUsage;
import com.ams.service.SparePartService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/spare-part-usages")
@RequiredArgsConstructor
public class SparePartUsageController {

    private final SparePartService sparePartService;

    @PreAuthorize("@ss.hasPermi('inventory:sparepart:consume')")
    @PostMapping
    public Result<SparePartUsage> create(@RequestBody SparePartUsage usage) {
        return Result.success(sparePartService.consumePart(usage));
    }

    @PreAuthorize("@ss.hasPermi('inventory:sparepart:query')")
    @GetMapping("/by-work-order/{workOrderId}")
    public Result<java.util.List<SparePartUsage>> getByWorkOrder(@PathVariable Long workOrderId) {
        return Result.success(sparePartService.getUsageByWorkOrder(workOrderId));
    }

    @PreAuthorize("@ss.hasPermi('inventory:sparepart:query')")
    @GetMapping("/by-spare-part/{sparePartId}")
    public Result<java.util.List<SparePartUsage>> getBySparePart(@PathVariable Long sparePartId) {
        return Result.success(sparePartService.getUsageBySparePart(sparePartId));
    }
}
