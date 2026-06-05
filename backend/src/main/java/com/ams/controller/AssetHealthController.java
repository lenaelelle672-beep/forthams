package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.AssetHealthVO;
import com.ams.service.AssetHealthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/asset-health")
@RequiredArgsConstructor
@Tag(name = "资产健康评分", description = "多维度资产健康评分计算")
public class AssetHealthController {

    private final AssetHealthService assetHealthService;

    @Operation(summary = "计算单资产健康评分", description = "基于年龄、维修频率、故障率、利用率、折旧进度计算")
    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping("/{assetId}")
    public Result<AssetHealthVO> getHealth(@PathVariable Long assetId) {
        return Result.success(assetHealthService.calculateHealth(assetId));
    }

    @Operation(summary = "批量计算资产健康评分")
    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @PostMapping("/batch")
    public Result<List<AssetHealthVO>> batchHealth(@RequestBody List<Long> assetIds) {
        return Result.success(assetHealthService.batchCalculateHealth(assetIds));
    }

    @Operation(summary = "获取不健康资产TopN")
    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping("/unhealthy")
    public Result<List<AssetHealthVO>> getUnhealthy(
            @RequestParam(defaultValue = "20") int topN,
            @RequestParam(defaultValue = "60") int minScore) {
        return Result.success(assetHealthService.getUnhealthyAssets(topN, minScore));
    }
}
