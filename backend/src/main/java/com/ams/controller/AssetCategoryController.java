package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.CategoryCreateDTO;
import com.ams.dto.CategoryTreeDTO;
import com.ams.dto.CategoryUpdateDTO;
import com.ams.entity.AssetCategory;
import com.ams.service.AssetCategoryService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/categories")
@RequiredArgsConstructor
public class AssetCategoryController {

    private final AssetCategoryService assetCategoryService;

    @GetMapping("/list")
    public Result<Page<AssetCategory>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword) {
        return Result.success(assetCategoryService.queryCategories(page, pageSize, keyword));
    }

    @GetMapping("/tree")
    public Result<List<CategoryTreeDTO>> tree() {
        return Result.success(assetCategoryService.getCategoryTree());
    }

    @GetMapping("/{id}")
    public Result<AssetCategory> getById(@PathVariable Long id) {
        return Result.success(assetCategoryService.getCategoryById(id));
    }

    @PostMapping
    public Result<AssetCategory> create(@RequestBody CategoryCreateDTO dto) {
        return Result.success(assetCategoryService.createCategory(dto));
    }

    @PutMapping("/{id}")
    public Result<AssetCategory> update(@PathVariable Long id, @RequestBody CategoryUpdateDTO dto) {
        return Result.success(assetCategoryService.updateCategory(id, dto));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        assetCategoryService.deleteCategory(id);
        return Result.success();
    }
}
