package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.CustomFieldDTO;
import com.ams.dto.CustomFieldMetaDTO;
import com.ams.dto.CustomFieldPreviewRequestDTO;
import com.ams.dto.CustomFieldPreviewRespDTO;
import com.ams.dto.CustomFieldQueryDTO;
import com.ams.service.CustomFieldService;
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
@RequestMapping("/system/custom-fields")
@RequiredArgsConstructor
public class CustomFieldController {

    private final CustomFieldService customFieldService;

    @GetMapping
    public Result<CustomFieldDTO.PageResult> list(@ModelAttribute CustomFieldQueryDTO query) {
        return Result.success(customFieldService.list(query));
    }

    @GetMapping("/all")
    public Result<List<CustomFieldDTO>> all() {
        return Result.success(customFieldService.all());
    }

    @GetMapping("/meta")
    public Result<CustomFieldMetaDTO> meta() {
        return Result.success(customFieldService.meta());
    }

    @PostMapping("/preview")
    public Result<CustomFieldPreviewRespDTO> preview(@RequestBody CustomFieldPreviewRequestDTO request) {
        return Result.success(customFieldService.preview(request));
    }

    @GetMapping("/{id}")
    public Result<CustomFieldDTO> detail(@PathVariable Long id) {
        return Result.success(customFieldService.detail(id));
    }
}
