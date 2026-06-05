package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.RiskControlMeasure;
import com.ams.service.RiskControlMeasureService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/risk-control-measures")
@RequiredArgsConstructor
public class RiskControlMeasureController {
    private final RiskControlMeasureService riskControlMeasureService;

    @PreAuthorize("@ss.hasPermi('risk:query')")
    @GetMapping
    public Result<Page<RiskControlMeasure>> listByRiskAssessment(
            @RequestParam Long riskAssessmentId,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(riskControlMeasureService.listByRiskAssessment(riskAssessmentId, pageNum, pageSize));
    }

    @PreAuthorize("@ss.hasPermi('risk:query')")
    @GetMapping("/{id}")
    public Result<RiskControlMeasure> getById(@PathVariable Long id) {
        return Result.success(riskControlMeasureService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('risk:create')")
    @PostMapping
    public Result<RiskControlMeasure> create(@Valid @RequestBody RiskControlMeasure measure) {
        return Result.success(riskControlMeasureService.create(measure));
    }

    @PreAuthorize("@ss.hasPermi('risk:edit')")
    @PutMapping("/{id}")
    public Result<RiskControlMeasure> update(@PathVariable Long id, @Valid @RequestBody RiskControlMeasure measure) {
        return Result.success(riskControlMeasureService.update(id, measure));
    }

    @PreAuthorize("@ss.hasPermi('risk:remove')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        riskControlMeasureService.delete(id);
        return Result.success();
    }
}