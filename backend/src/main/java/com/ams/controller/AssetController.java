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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import jakarta.validation.constraints.Positive;

@RestController
@RequestMapping("/assets")
@RequiredArgsConstructor
@Validated
public class AssetController {
    private final AssetService assetService;

    @GetMapping
    @PreAuthorize("hasAuthority('asset:query')")
    public Result<Page<Asset>> listRoot(AssetQueryDTO queryDTO) {
        return list(queryDTO);
    }

    @GetMapping("/list")
    @PreAuthorize("hasAuthority('asset:query')")
    public Result<Page<Asset>> list(AssetQueryDTO queryDTO) {
        return Result.success(assetService.queryAssets(queryDTO));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('asset:query')")
    public Result<Asset> getById(@PathVariable @Positive Long id) {
        return Result.success(assetService.getAssetById(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('asset:create')")
    @ResponseStatus(HttpStatus.CREATED)
    public Result<Asset> create(@Valid @RequestBody AssetCreateDTO createDTO) {
        return Result.success(assetService.createAsset(createDTO));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('asset:update')")
    public Result<Asset> update(@PathVariable @Positive Long id, @Valid @RequestBody AssetUpdateDTO updateDTO) {
        return Result.success(assetService.updateAsset(id, updateDTO));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('asset:delete')")
    public Result<Void> delete(@PathVariable @Positive Long id) {
        assetService.deleteAsset(id);
        return Result.success();
    }
}
