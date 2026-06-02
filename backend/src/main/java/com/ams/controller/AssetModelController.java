package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.AssetModel;
import com.ams.service.AssetModelService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/asset-models")
@RequiredArgsConstructor
public class AssetModelController {

    private final AssetModelService assetModelService;

    @PreAuthorize("@ss.hasPermi('asset:model:query')")
    @GetMapping
    public Result<Map<String, Object>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Long manufacturerId) {
        Page<AssetModel> result = assetModelService.getPage(page, pageSize, keyword, categoryId, manufacturerId);
        return Result.success(Map.of("records", result.getRecords(), "total", result.getTotal()));
    }

    @PreAuthorize("@ss.hasPermi('asset:model:query')")
    @GetMapping("/{id}")
    public Result<AssetModel> detail(@PathVariable Long id) {
        return Result.success(assetModelService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:model:query')")
    @GetMapping("/options")
    public Result<List<AssetModel>> options() {
        return Result.success(assetModelService.getOptions());
    }

    @PreAuthorize("@ss.hasPermi('asset:model:create')")
    @PostMapping
    public Result<AssetModel> create(@RequestBody AssetModel model) {
        return Result.success(assetModelService.create(model));
    }

    @PreAuthorize("@ss.hasPermi('asset:model:edit')")
    @PutMapping("/{id}")
    public Result<AssetModel> update(@PathVariable Long id, @RequestBody AssetModel model) {
        return Result.success(assetModelService.update(id, model));
    }

    @PreAuthorize("@ss.hasPermi('asset:model:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        assetModelService.delete(id);
        return Result.success();
    }
}
