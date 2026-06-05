package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.TcoCompareDTO;
import com.ams.dto.TcoResultDTO;
import com.ams.dto.TcoTrendDTO;
import com.ams.entity.TCORecord;
import com.ams.service.TcoService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.context.TenantContext;
import com.ams.mapper.TCORecordMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/tco")
@RequiredArgsConstructor
public class TcoController {

    private final TcoService tcoService;
    private final TCORecordMapper tcoRecordMapper;

    @PreAuthorize("@ss.hasPermi('tco:query')")
    @GetMapping("/asset/{assetId}")
    public Result<TcoResultDTO> calculateAssetTco(@PathVariable Long assetId) {
        return Result.success(tcoService.calculateTco(assetId));
    }

    @PreAuthorize("@ss.hasPermi('tco:query')")
    @GetMapping("/department/{deptId}")
    public Result<List<TcoResultDTO>> departmentTco(@PathVariable Long deptId) {
        return Result.success(tcoService.getTcoByDepartment(deptId));
    }

    @PreAuthorize("@ss.hasPermi('tco:query')")
    @GetMapping("/category/{categoryId}")
    public Result<List<TcoResultDTO>> categoryTco(@PathVariable Long categoryId) {
        return Result.success(tcoService.getTcoByCategory(categoryId));
    }

    @PreAuthorize("@ss.hasPermi('tco:trend')")
    @GetMapping("/trend")
    public Result<List<TcoTrendDTO>> trend(
            @RequestParam Long assetId,
            @RequestParam(defaultValue = "12") int months) {
        return Result.success(tcoService.getTcoTrend(assetId, months));
    }

    @PreAuthorize("@ss.hasPermi('tco:query')")
    @GetMapping("/compare/{categoryId}")
    public Result<List<TcoCompareDTO>> compare(@PathVariable Long categoryId) {
        return Result.success(tcoService.getCategoryComparison(categoryId));
    }

    @PreAuthorize("@ss.hasPermi('tco:query')")
    @GetMapping("/history/{assetId}")
    public Result<Page<TCORecord>> history(@PathVariable Long assetId,
                                            @RequestParam(defaultValue = "1") int page,
                                            @RequestParam(defaultValue = "10") int size) {
        String tenantId = TenantContext.requireTenantId();
        return Result.success(tcoRecordMapper.selectPage(new Page<>(page, size),
                new QueryWrapper<TCORecord>()
                        .eq("tenant_id", tenantId)
                        .eq("asset_id", assetId)
                        .orderByDesc("calculation_date")));
    }
}
