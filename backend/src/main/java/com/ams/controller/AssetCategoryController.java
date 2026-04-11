package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.CategoryCreateDTO;
import com.ams.dto.CategoryUpdateDTO;
import com.ams.entity.AssetCategory;
import com.ams.service.AssetCategoryService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/categories")
@RequiredArgsConstructor
public class AssetCategoryController {

    private final AssetCategoryService assetCategoryService;

    @Auditable
    @GetMapping("/list")
    public Result<Page<AssetCategory>> list(
        @RequestParam(defaultValue = "1") Integer page,
        @RequestParam(defaultValue = "10") Integer pageSize,
        @RequestParam(required = false) String keyword
    ) {
        Page<AssetCategory> result = assetCategoryService.queryCategories(page, pageSize, keyword);
        return Result.success(result);
    }

    @Auditable
    @GetMapping("/all")
    public Result<List<AssetCategory>> all() {
        return Result.success(assetCategoryService.listAllCategories());
    }

    @Auditable
    @GetMapping("/tree")
    public Result<List<com.ams.dto.CategoryTreeDTO>> getTree() {
        return Result.success(assetCategoryService.getCategoryTree());
    }

    @Auditable
    @GetMapping("/{id}")
    public Result<AssetCategory> getById(@PathVariable Long id) {
        return Result.success(assetCategoryService.getCategoryById(id));
    }

    @Auditable
    @PostMapping
    public Result<AssetCategory> create(@Valid @RequestBody CategoryCreateDTO createDTO) {
        AssetCategory category = assetCategoryService.createCategory(createDTO);
        return Result.success("创建成功", category);
    }

    @Auditable
    @PutMapping("/{id}")
    public Result<AssetCategory> update(@PathVariable Long id, @Valid @RequestBody CategoryUpdateDTO updateDTO) {
        AssetCategory category = assetCategoryService.updateCategory(id, updateDTO);
        return Result.success("更新成功", category);
    }

    @Auditable
    @DeleteMapping("/{id}")
    public Result<String> delete(@PathVariable Long id) {
        assetCategoryService.deleteCategory(id);
        return Result.success("删除成功");
    }
}
