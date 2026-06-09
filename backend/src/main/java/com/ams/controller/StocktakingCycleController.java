package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.StocktakingCycleStatsDTO;
import com.ams.entity.StocktakingCycle;
import com.ams.entity.StocktakingTask;
import com.ams.service.StocktakingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/stocktaking/cycles")
@RequiredArgsConstructor
@Tag(name = "循环盘点管理", description = "循环盘点周期 CRUD、任务分配、暂停恢复")
public class StocktakingCycleController {

    private final StocktakingService stocktakingService;

    @Operation(summary = "查询盘点周期列表")
    @PreAuthorize("@ss.hasPermi('stocktaking:cycle:query')")
    @GetMapping
    public Result<List<StocktakingCycle>> list(@RequestParam(required = false) String status) {
        return Result.success(stocktakingService.listCycles(status));
    }

    @Operation(summary = "创建盘点周期")
    @PreAuthorize("@ss.hasPermi('stocktaking:cycle:add')")
    @PostMapping
    public Result<Void> create(@RequestBody StocktakingCycle cycle) {
        stocktakingService.startCycle(cycle);
        return Result.success();
    }

    @Operation(summary = "获取盘点周期详情")
    @PreAuthorize("@ss.hasPermi('stocktaking:cycle:query')")
    @GetMapping("/{id}")
    public Result<StocktakingCycle> get(@PathVariable Long id) {
        return Result.success(stocktakingService.getCycleById(id));
    }

    @Operation(summary = "获取周期统计")
    @PreAuthorize("@ss.hasPermi('stocktaking:cycle:query')")
    @GetMapping("/{id}/stats")
    public Result<StocktakingCycleStatsDTO> getStats(@PathVariable Long id) {
        return Result.success(stocktakingService.getCycleStats(id));
    }

    @Operation(summary = "分配盘点任务")
    @PreAuthorize("@ss.hasPermi('stocktaking:cycle:edit')")
    @PostMapping("/{id}/assign")
    public Result<Void> assignTasks(
            @PathVariable Long id,
            @RequestParam(required = false) String abcFilter,
            @RequestParam(required = false, defaultValue = "combined") String strategy) {
        stocktakingService.assignTasks(id, abcFilter, strategy);
        return Result.success();
    }

    @Operation(summary = "暂停盘点周期")
    @PreAuthorize("@ss.hasPermi('stocktaking:cycle:edit')")
    @PostMapping("/{id}/pause")
    public Result<Void> pause(@PathVariable Long id) {
        stocktakingService.pauseCycle(id);
        return Result.success();
    }

    @Operation(summary = "恢复盘点周期")
    @PreAuthorize("@ss.hasPermi('stocktaking:cycle:edit')")
    @PostMapping("/{id}/resume")
    public Result<Void> resume(@PathVariable Long id) {
        stocktakingService.resumeCycle(id);
        return Result.success();
    }

    @Operation(summary = "完成盘点周期")
    @PreAuthorize("@ss.hasPermi('stocktaking:cycle:edit')")
    @PostMapping("/{id}/complete")
    public Result<Void> complete(@PathVariable Long id) {
        stocktakingService.completeCycle(id);
        return Result.success();
    }

    @Operation(summary = "获取周期任务列表")
    @PreAuthorize("@ss.hasPermi('stocktaking:cycle:query')")
    @GetMapping("/{id}/tasks")
    public Result<List<StocktakingTask>> getTasks(@PathVariable Long id) {
        return Result.success(stocktakingService.getTasksByCycleId(id));
    }
}
