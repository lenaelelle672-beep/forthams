package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.RiskMatrix;
import com.ams.service.RiskMatrixService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 风险矩阵配置控制器
 */
@RestController
@RequestMapping("/risk-matrix")
@RequiredArgsConstructor
public class RiskMatrixController {

    private final RiskMatrixService riskMatrixService;

    @PreAuthorize("@ss.hasPermi('risk:matrix:query')")
    @GetMapping({"", "/list"})
    public Result<Page<RiskMatrix>> list(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(riskMatrixService.list(pageNum, pageSize));
    }

    @PreAuthorize("@ss.hasPermi('risk:matrix:query')")
    @GetMapping("/active")
    public Result<List<RiskMatrix>> getActive() {
        return Result.success(riskMatrixService.getActiveMatrix());
    }

    @PreAuthorize("@ss.hasPermi('risk:matrix:query')")
    @GetMapping("/{id}")
    public Result<RiskMatrix> getById(@PathVariable Long id) {
        return Result.success(riskMatrixService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('risk:matrix:create')")
    @PostMapping
    public Result<RiskMatrix> create(@Valid @RequestBody RiskMatrix matrix) {
        return Result.success(riskMatrixService.create(matrix));
    }

    @PreAuthorize("@ss.hasPermi('risk:matrix:edit')")
    @PutMapping("/{id}")
    public Result<RiskMatrix> update(@PathVariable Long id, @Valid @RequestBody RiskMatrix matrix) {
        return Result.success(riskMatrixService.update(id, matrix));
    }

    @PreAuthorize("@ss.hasPermi('risk:matrix:remove')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        riskMatrixService.delete(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('risk:matrix:edit')")
    @PutMapping("/{id}/active")
    public Result<Void> setActive(@PathVariable Long id, @RequestParam Integer active) {
        riskMatrixService.setActive(id, active);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('risk:query')")
    @GetMapping("/calculate")
    public Result<Map<String, Object>> calculateRiskLevel(
            @RequestParam Integer probability,
            @RequestParam Integer severity) {
        String level = riskMatrixService.calculateRiskLevel(probability, severity);
        return Result.success(Map.of(
                "probability", probability,
                "severity", severity,
                "score", probability * severity,
                "riskLevel", level
        ));
    }
}