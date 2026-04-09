package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.AssetCreateDTO;
import com.ams.dto.AssetQueryDTO;
import com.ams.dto.AssetUpdateDTO;
import com.ams.entity.Asset;
import com.ams.service.AssetService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/assets")
@RequiredArgsConstructor
public class AssetController {

    private final AssetService assetService;

    @GetMapping("/list")
    public Result<Page<Asset>> list(AssetQueryDTO queryDTO) {
        Page<Asset> page = assetService.queryAssets(queryDTO);
        return Result.success(page);
    }

    @GetMapping("/{id}")
    public Result<Asset> getById(@PathVariable Long id) {
        Asset asset = assetService.getAssetById(id);
        return Result.success(asset);
    }

    @PostMapping
    public Result<Asset> create(@Valid @RequestBody AssetCreateDTO createDTO) {
        Asset asset = assetService.createAsset(createDTO);
        return Result.success("创建成功", asset);
    }

    @PutMapping("/{id}")
    public Result<Asset> update(@PathVariable Long id, @Valid @RequestBody AssetUpdateDTO updateDTO) {
        Asset asset = assetService.updateAsset(id, updateDTO);
        return Result.success("更新成功", asset);
    }

    @DeleteMapping("/{id}")
    public Result<String> delete(@PathVariable Long id) {
        assetService.deleteAsset(id);
        return Result.success("删除成功");
    }

}
