package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.StocktakingCycle;
import com.ams.entity.StocktakingTask;
import com.ams.mapper.StocktakingCycleMapper;
import com.ams.service.StocktakingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/stocktaking/cycles")
@RequiredArgsConstructor
@Tag(name = "循环盘点管理", description = "循环盘点周期 CRUD、任务分配、暂停恢复")
public class StocktakingCycleController {

    private final StocktakingService stocktakingService;
    private final StocktakingCycleMapper cycleMapper;

    @Operation(summary = "查询盘点周期列表")
    @GetMapping
    public Result<List<StocktakingCycle>> list() {
        return Result.success(null);
    }

    @Operation(summary = "创建盘点周期")
    @PostMapping
    public Result<Void> create(@RequestBody StocktakingCycle cycle) {
        stocktakingService.startCycle(cycle);
        return Result.success();
    }

    @Operation(summary = "获取盘点周期详情")
    @GetMapping("/{id}")
    public Result<StocktakingCycle> get(@PathVariable Long id) {
        return Result.success(null);
    }

    @Operation(summary = "分配盘点任务")
    @PostMapping("/{id}/assign")
    public Result<Void> assignTasks(
            @PathVariable Long id,
            @RequestParam(required = false) String abcFilter,
            @RequestParam(required = false, defaultValue = "combined") String strategy) {
        stocktakingService.assignTasks(id, abcFilter, strategy);
        return Result.success();
    }

    @Operation(summary = "暂停盘点周期")
    @PostMapping("/{id}/pause")
    public Result<Void> pause(@PathVariable Long id) {
        stocktakingService.pauseCycle(id);
        return Result.success();
    }

    @Operation(summary = "恢复盘点周期")
    @PostMapping("/{id}/resume")
    public Result<Void> resume(@PathVariable Long id) {
        stocktakingService.resumeCycle(id);
        return Result.success();
    }

    @Operation(summary = "完成盘点周期")
    @PostMapping("/{id}/complete")
    public Result<Void> complete(@PathVariable Long id) {
        stocktakingService.completeCycle(id);
        return Result.success();
    }

    @Operation(summary = "获取周期任务列表")
    @GetMapping("/{id}/tasks")
    public Result<List<StocktakingTask>> getTasks(@PathVariable Long id) {
        return Result.success(stocktakingService.getTasksByCycleId(id));
    }
}