package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.RiskAssessment;
import com.ams.service.RiskAssessmentService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/risk-assessments")
@RequiredArgsConstructor
public class RiskAssessmentController {
    private final RiskAssessmentService riskAssessmentService;

    @PreAuthorize("@ss.hasPermi('risk:query')")
    @GetMapping({"", "/list"})
    public Result<Page<RiskAssessment>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String riskLevel,
            @RequestParam(required = false) Long assetId,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortOrder,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        if (sortBy != null && !sortBy.isEmpty()) {
            return Result.success(riskAssessmentService.listWithSort(keyword, riskLevel, assetId,
                    sortBy, sortOrder, pageNum, pageSize));
        }
        return Result.success(riskAssessmentService.list(keyword, riskLevel, assetId, pageNum, pageSize));
    }

    @PreAuthorize("@ss.hasPermi('risk:query')")
    @GetMapping("/matrix")
    public Result<List<Map<String, Object>>> getMatrix() {
        return Result.success(riskAssessmentService.getHeatmapData());
    }

    @PreAuthorize("@ss.hasPermi('risk:query')")
    @GetMapping("/trend")
    public Result<List<Map<String, Object>>> getTrend(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "month") String period) {
        return Result.success(riskAssessmentService.getRiskLevelTrend(startDate, endDate, period));
    }

    @PreAuthorize("@ss.hasPermi('risk:query')")
    @GetMapping("/{id}")
    public Result<RiskAssessment> getById(@PathVariable Long id) {
        return Result.success(riskAssessmentService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('risk:create')")
    @PostMapping
    public Result<RiskAssessment> create(@Valid @RequestBody RiskAssessment assessment) {
        return Result.success(riskAssessmentService.create(assessment));
    }

    @PreAuthorize("@ss.hasPermi('risk:edit')")
    @PutMapping("/{id}")
    public Result<RiskAssessment> update(@PathVariable Long id, @Valid @RequestBody RiskAssessment assessment) {
        return Result.success(riskAssessmentService.update(id, assessment));
    }

    @PreAuthorize("@ss.hasPermi('risk:remove')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        riskAssessmentService.delete(id);
        return Result.success();
    }
}
