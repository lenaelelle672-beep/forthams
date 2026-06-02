package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.AssetCreateDTO;
import com.ams.dto.AssetQueryDTO;
import com.ams.dto.AssetUpdateDTO;
import com.ams.entity.Asset;
import com.ams.service.AssetService;
import com.ams.service.DepreciationService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/assets")
@RequiredArgsConstructor
public class AssetController {
    private final AssetService assetService;
    private final DepreciationService depreciationService;

    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping({"", "/list"})
    public Result<Page<Asset>> list(AssetQueryDTO queryDTO) {
        return Result.success(assetService.queryAssets(queryDTO));
    }

    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping("/{id}")
    public Result<Asset> getById(@PathVariable Long id) {
        return Result.success(assetService.getAssetById(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping("/{id}/depreciation-schedule")
    public Result<java.util.List<DepreciationService.DepreciationScheduleItem>> getDepreciationSchedule(
            @PathVariable Long id,
            @RequestParam(required = false) String period) {
        return Result.success(depreciationService.getScheduleByAssetId(id, period));
    }

    @PreAuthorize("@ss.hasPermi('asset:ledger:create')")
    @PostMapping
    public Result<Asset> create(@Valid @RequestBody AssetCreateDTO createDTO) {
        return Result.success(assetService.createAsset(createDTO));
    }

    @PreAuthorize("@ss.hasPermi('asset:ledger:edit')")
    @PutMapping("/{id}")
    public Result<Asset> update(@PathVariable Long id, @Valid @RequestBody AssetUpdateDTO updateDTO) {
        return Result.success(assetService.updateAsset(id, updateDTO));
    }

    @PreAuthorize("@ss.hasPermi('asset:ledger:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        assetService.deleteAsset(id);
        return Result.success();
    }
}
