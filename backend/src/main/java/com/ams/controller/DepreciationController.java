package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.DepreciationMethodVO;
import com.ams.entity.DepreciationRecord;
import com.ams.enums.DepreciationMethodEnum;
import com.ams.service.DepreciationRecordService;
import com.ams.service.DepreciationService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/depreciation")
@RequiredArgsConstructor
public class DepreciationController {

    private final DepreciationService depreciationService;
    private final DepreciationRecordService depreciationRecordService;

    @PreAuthorize("@ss.hasPermi('depreciation:query')")
    @GetMapping("/schedules")
    public Result<DepreciationService.DepreciationSchedulePage> schedules(
            @RequestParam(required = false) String assetNo,
            @RequestParam(required = false) String period,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        return Result.success(depreciationService.getSchedules(assetNo, period, page, size));
    }

    @PreAuthorize("@ss.hasPermi('depreciation:calculate')")
    @PostMapping("/calculate")
    public Result<DepreciationService.BatchCalculateResponse> calculate(
            @Valid @RequestBody BatchCalculateRequest request) {
        return Result.success(depreciationService.calculate(request.assetIds()));
    }

    @PreAuthorize("@ss.hasPermi('depreciation:records')")
    @GetMapping("/records")
    public Result<Page<DepreciationRecord>> records(
            @RequestParam(required = false) Long assetId,
            @RequestParam(required = false) String periodStart,
            @RequestParam(required = false) String periodEnd,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size) {
        if (assetId != null) {
            return Result.success(depreciationRecordService.getRecordsByAssetId(assetId, page, size));
        }
        if (periodStart != null && periodEnd != null) {
            return Result.success(depreciationRecordService.getRecordsByPeriod(
                    LocalDate.parse(periodStart), LocalDate.parse(periodEnd), page, size));
        }
        return Result.success(depreciationRecordService.getRecordsByAssetId(null, page, size));
    }

    @PreAuthorize("@ss.hasPermi('depreciation:methods')")
    @GetMapping("/methods")
    public Result<List<DepreciationMethodVO>> methods() {
        List<DepreciationMethodVO> list = Arrays.stream(DepreciationMethodEnum.values())
                .map(e -> new DepreciationMethodVO(e.name(), e.getLabel()))
                .toList();
        return Result.success(list);
    }

    @PreAuthorize("@ss.hasPermi('depreciation:query')")
    @GetMapping("/comparison/{assetId}")
    public Result<DepreciationService.DepreciationComparisonPage> comparison(
            @PathVariable Long assetId,
            @RequestParam(required = false) String period) {
        return Result.success(depreciationService.getComparison(assetId, period));
    }

    public record BatchCalculateRequest(List<Long> assetIds) {
    }
}
