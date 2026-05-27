package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.CategoryCreateDTO;
import com.ams.dto.CategoryTreeDTO;
import com.ams.dto.CategoryUpdateDTO;
import com.ams.entity.AssetCategory;
import com.ams.service.AssetCategoryService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;

@RestController
@RequestMapping("/categories")
@RequiredArgsConstructor
public class AssetCategoryController {
    private final AssetCategoryService assetCategoryService;

    @PreAuthorize("@ss.hasPermi('asset:category:query')")
    @GetMapping("/list")
    public Result<Page<AssetCategory>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword) {
        return Result.success(assetCategoryService.queryCategories(page, pageSize, keyword));
    }

    @PreAuthorize("@ss.hasPermi('asset:category:query')")
    @GetMapping("/tree")
    public Result<List<CategoryTreeDTO>> tree() {
        return Result.success(assetCategoryService.getCategoryTree());
    }

    @PreAuthorize("@ss.hasPermi('asset:category:query')")
    @GetMapping("/{id}")
    public Result<AssetCategory> getById(@PathVariable Long id) {
        return Result.success(assetCategoryService.getCategoryById(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:category:create')")
    @PostMapping
    public Result<AssetCategory> create(@Valid @RequestBody CategoryCreateDTO dto) {
        return Result.success("创建成功", assetCategoryService.createCategory(dto));
    }

    @PreAuthorize("@ss.hasPermi('asset:category:edit')")
    @PutMapping("/{id}")
    public Result<AssetCategory> update(@PathVariable Long id, @Valid @RequestBody CategoryUpdateDTO dto) {
        return Result.success("更新成功", assetCategoryService.updateCategory(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('asset:category:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        assetCategoryService.deleteCategory(id);
        return Result.success("删除成功", null);
    }

    @PreAuthorize("@ss.hasPermi('asset:category:query')")
    @GetMapping("/all")
    public Result<List<AssetCategory>> all() {
        return Result.success(assetCategoryService.listAllCategories());
    }
}
