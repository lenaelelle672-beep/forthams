package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.AssetCreateDTO;
import com.ams.dto.AssetQueryDTO;
import com.ams.dto.AssetUpdateDTO;
import com.ams.entity.Asset;
import com.ams.service.AssetService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/assets")
@RequiredArgsConstructor
public class AssetController {
    private final AssetService assetService;

    @GetMapping
    public Result<Page<Asset>> listRoot(AssetQueryDTO queryDTO) {
        return list(queryDTO);
    }

    @GetMapping("/list")
    public Result<Page<Asset>> list(AssetQueryDTO queryDTO) {
        return Result.success(assetService.queryAssets(queryDTO));
    }

    @GetMapping("/{id}")
    public Result<Asset> getById(@PathVariable Long id) {
        return Result.success(assetService.getAssetById(id));
    }

    @PostMapping
    public Result<Asset> create(@RequestBody AssetCreateDTO createDTO) {
        return Result.success(assetService.createAsset(createDTO));
    }

    @PutMapping("/{id}")
    public Result<Asset> update(@PathVariable Long id, @RequestBody AssetUpdateDTO updateDTO) {
        return Result.success(assetService.updateAsset(id, updateDTO));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        assetService.deleteAsset(id);
        return Result.success();
    }
}
