package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.FloorPlan;
import com.ams.entity.FloorPlanAsset;
import com.ams.service.FloorPlanService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/floor-plans")
@RequiredArgsConstructor
public class FloorPlanController {

    private final FloorPlanService floorPlanService;

    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping
    public Result<Map<String, Object>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword) {
        Page<FloorPlan> result = floorPlanService.listPage(page, pageSize, keyword);
        return Result.success(Map.of("records", result.getRecords(), "total", result.getTotal()));
    }

    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/{id}")
    public Result<FloorPlan> detail(@PathVariable Long id) {
        return Result.success(floorPlanService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:create')")
    @PostMapping
    public Result<FloorPlan> create(@RequestBody FloorPlan plan) {
        return Result.success(floorPlanService.create(plan));
    }

    @PreAuthorize("@ss.hasPermi('asset:edit')")
    @PutMapping("/{id}")
    public Result<FloorPlan> update(@PathVariable Long id, @RequestBody FloorPlan plan) {
        return Result.success(floorPlanService.update(id, plan));
    }

    @PreAuthorize("@ss.hasPermi('asset:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        floorPlanService.delete(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('asset:query')")
    @GetMapping("/{id}/assets")
    public Result<List<FloorPlanAsset>> getAssets(@PathVariable Long id) {
        return Result.success(floorPlanService.getPlanAssets(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:edit')")
    @PostMapping("/{id}/assets")
    public Result<FloorPlanAsset> placeAsset(@PathVariable Long id,
                                              @RequestBody Map<String, Object> body) {
        return Result.success(floorPlanService.placeAsset(id,
                Long.valueOf(body.get("assetId").toString()),
                new BigDecimal(body.get("posX").toString()),
                new BigDecimal(body.get("posY").toString()),
                (String) body.get("label")));
    }

    @PreAuthorize("@ss.hasPermi('asset:edit')")
    @DeleteMapping("/{planId}/assets/{assetId}")
    public Result<Void> removeAsset(@PathVariable Long planId, @PathVariable Long assetId) {
        floorPlanService.removeAsset(planId, assetId);
        return Result.success();
    }
}
