package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.CustomFieldCreateDTO;
import com.ams.dto.CustomFieldUpdateDTO;
import com.ams.entity.CustomField;
import com.ams.service.CustomFieldService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/system/custom-fields")
@RequiredArgsConstructor
public class CustomFieldController {

    private final CustomFieldService customFieldService;

    @PreAuthorize("@ss.hasPermi('custom:field:query')")
    @GetMapping
    public Result<Page<CustomField>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword) {
        return Result.success(customFieldService.queryFields(page, pageSize, keyword));
    }

    @PreAuthorize("@ss.hasPermi('custom:field:query')")
    @GetMapping("/all")
    public Result<List<CustomField>> all() {
        return Result.success(customFieldService.listAll());
    }

    @PreAuthorize("@ss.hasPermi('custom:field:query')")
    @GetMapping("/{id}")
    public Result<CustomField> getById(@PathVariable Long id) {
        return Result.success(customFieldService.getFieldById(id));
    }

    @PreAuthorize("@ss.hasPermi('custom:field:create')")
    @PostMapping
    public Result<CustomField> create(@Valid @RequestBody CustomFieldCreateDTO dto) {
        return Result.success("创建成功", customFieldService.createField(dto));
    }

    @PreAuthorize("@ss.hasPermi('custom:field:edit')")
    @PutMapping("/{id}")
    public Result<CustomField> update(@PathVariable Long id, @Valid @RequestBody CustomFieldUpdateDTO dto) {
        return Result.success("更新成功", customFieldService.updateField(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('custom:field:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        customFieldService.deleteField(id);
        return Result.success("删除成功", null);
    }
}
