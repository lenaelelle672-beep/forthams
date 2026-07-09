package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.CustomFieldDTO;
import com.ams.dto.CustomFieldsetDTO;
import com.ams.dto.CustomFieldsetMetaDTO;
import com.ams.dto.CustomFieldsetPreviewRequestDTO;
import com.ams.dto.CustomFieldsetPreviewRespDTO;
import com.ams.dto.CustomFieldsetQueryDTO;
import com.ams.service.CustomFieldsetService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/system/custom-fieldsets")
@RequiredArgsConstructor
public class CustomFieldsetController {

    private final CustomFieldsetService customFieldsetService;

    @GetMapping
    public Result<CustomFieldsetDTO.PageResult> list(@ModelAttribute CustomFieldsetQueryDTO query) {
        return Result.success(customFieldsetService.list(query));
    }

    @GetMapping("/all")
    public Result<List<CustomFieldsetDTO>> all() {
        return Result.success(customFieldsetService.all());
    }

    @GetMapping("/meta")
    public Result<CustomFieldsetMetaDTO> meta() {
        return Result.success(customFieldsetService.meta());
    }

    @PostMapping("/preview")
    public Result<CustomFieldsetPreviewRespDTO> preview(@RequestBody CustomFieldsetPreviewRequestDTO request) {
        return Result.success(customFieldsetService.preview(request));
    }

    @GetMapping("/by-category/{categoryId}")
    public Result<CustomFieldsetDTO> byCategory(@PathVariable Long categoryId) {
        return Result.success(customFieldsetService.byCategory(categoryId));
    }

    @GetMapping("/{id}/fields")
    public Result<List<CustomFieldDTO>> fields(@PathVariable Long id) {
        return Result.success(customFieldsetService.fields(id));
    }

    @GetMapping("/{id}")
    public Result<CustomFieldsetDTO> detail(@PathVariable Long id) {
        return Result.success(customFieldsetService.detail(id));
    }
}
