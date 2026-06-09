package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.StocktakingTask;
import com.ams.service.StocktakingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/stocktaking/tasks")
@RequiredArgsConstructor
@Tag(name = "盘点任务管理", description = "盘点任务扫描、照片上传、差异调整")
public class StocktakingTaskController {

    private final StocktakingService stocktakingService;

    @Data
    public static class ScanRequest {
        private Integer quantity;
        private String photoUrl;
    }

    @Data
    public static class AdjustRequest {
        private Integer threshold;
    }

    @Operation(summary = "获取任务详情")
    @PreAuthorize("@ss.hasPermi('stocktaking:cycle:query')")
    @GetMapping("/{id}")
    public Result<StocktakingTask> get(@PathVariable Long id) {
        return Result.success(stocktakingService.getTaskById(id));
    }

    @Operation(summary = "扫码录入盘点结果")
    @PreAuthorize("@ss.hasPermi('stocktaking:cycle:edit')")
    @PostMapping("/{id}/scan")
    public Result<Void> scan(
            @PathVariable Long id,
            @RequestBody ScanRequest request) {
        StocktakingTask task = stocktakingService.getTaskById(id);
        task.setActualQuantity(request.getQuantity());
        task.setPhotoUrl(request.getPhotoUrl());
        task.setStatus("COUNTED");
        return Result.success();
    }

    @Operation(summary = "调整盘点差异")
    @PreAuthorize("@ss.hasPermi('stocktaking:cycle:edit')")
    @PostMapping("/{id}/adjust")
    public Result<Void> adjust(
            @PathVariable Long id,
            @RequestBody AdjustRequest request) {
        stocktakingService.adjustVariance(id, request.getThreshold());
        return Result.success();
    }
}
