package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.CustomFieldsetAssignDTO;
import com.ams.dto.CustomFieldsetCreateDTO;
import com.ams.entity.CustomField;
import com.ams.entity.CustomFieldset;
import com.ams.service.CustomFieldsetService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/system/custom-fieldsets")
@RequiredArgsConstructor
public class CustomFieldsetController {

    private final CustomFieldsetService customFieldsetService;

    @PreAuthorize("@ss.hasPermi('custom:fieldset:query')")
    @GetMapping
    public Result<Page<CustomFieldset>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword) {
        return Result.success(customFieldsetService.queryFieldsets(page, pageSize, keyword));
    }

    @PreAuthorize("@ss.hasPermi('custom:fieldset:query')")
    @GetMapping("/all")
    public Result<List<CustomFieldset>> all() {
        return Result.success(customFieldsetService.listAll());
    }

    @PreAuthorize("@ss.hasPermi('custom:fieldset:query')")
    @GetMapping("/{id}")
    public Result<CustomFieldset> getById(@PathVariable Long id) {
        return Result.success(customFieldsetService.getFieldsetById(id));
    }

    @PreAuthorize("@ss.hasPermi('custom:fieldset:create')")
    @PostMapping
    public Result<CustomFieldset> create(@Valid @RequestBody CustomFieldsetCreateDTO dto) {
        return Result.success("创建成功", customFieldsetService.createFieldset(dto));
    }

    @PreAuthorize("@ss.hasPermi('custom:fieldset:edit')")
    @PutMapping("/{id}")
    public Result<CustomFieldset> update(@PathVariable Long id, @Valid @RequestBody CustomFieldsetCreateDTO dto) {
        return Result.success("更新成功", customFieldsetService.updateFieldset(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('custom:fieldset:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        customFieldsetService.deleteFieldset(id);
        return Result.success("删除成功", null);
    }

    @PreAuthorize("@ss.hasPermi('custom:fieldset:edit')")
    @PostMapping("/{id}/fields")
    public Result<Void> assignFields(@PathVariable Long id, @RequestBody CustomFieldsetAssignDTO dto) {
        customFieldsetService.assignFields(id, dto.getFieldIds());
        return Result.success("关联字段成功", null);
    }

    @PreAuthorize("@ss.hasPermi('custom:fieldset:query')")
    @GetMapping("/{id}/fields")
    public Result<List<CustomField>> getFields(@PathVariable Long id) {
        return Result.success(customFieldsetService.getFieldsByFieldsetId(id));
    }

    @PreAuthorize("@ss.hasPermi('custom:fieldset:query')")
    @GetMapping("/by-category/{categoryId}")
    public Result<CustomFieldset> getByCategory(@PathVariable Long categoryId) {
        com.ams.entity.AssetCategory category = customFieldsetService.getFieldsetByCategory(categoryId);
        if (category == null || category.getFieldsetId() == null) {
            return Result.success(null);
        }
        return Result.success(customFieldsetService.getFieldsetById(category.getFieldsetId()));
    }

}
