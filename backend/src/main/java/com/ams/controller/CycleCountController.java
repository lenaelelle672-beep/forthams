package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.CycleCountRule;
import com.ams.service.CycleCountRuleService;
import com.ams.service.CycleCountService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/cycle-count")
@RequiredArgsConstructor
public class CycleCountController {
    private final CycleCountRuleService ruleService;
    private final CycleCountService cycleCountService;

    @PreAuthorize("@ss.hasPermi('cycle-count:query')")
    @GetMapping("/rules")
    public Result<Page<CycleCountRule>> listRules(
            @RequestParam(required = false) String classification,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(ruleService.list(classification, pageNum, pageSize));
    }

    @PreAuthorize("@ss.hasPermi('cycle-count:query')")
    @GetMapping("/rules/{id}")
    public Result<CycleCountRule> getRule(@PathVariable Long id) {
        return Result.success(ruleService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('cycle-count:create')")
    @PostMapping("/rules")
    public Result<CycleCountRule> createRule(@Valid @RequestBody CycleCountRule rule) {
        return Result.success(ruleService.create(rule));
    }

    @PreAuthorize("@ss.hasPermi('cycle-count:edit')")
    @PutMapping("/rules/{id}")
    public Result<CycleCountRule> updateRule(@PathVariable Long id, @Valid @RequestBody CycleCountRule rule) {
        return Result.success(ruleService.update(id, rule));
    }

    @PreAuthorize("@ss.hasPermi('cycle-count:edit')")
    @DeleteMapping("/rules/{id}")
    public Result<Void> deleteRule(@PathVariable Long id) {
        ruleService.delete(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('cycle-count:create')")
    @PostMapping("/trigger")
    public Result<String> triggerGenerate(@RequestParam String classification) {
        cycleCountService.triggerGenerate(classification);
        return Result.success("盘点任务已触发生成");
    }
}
