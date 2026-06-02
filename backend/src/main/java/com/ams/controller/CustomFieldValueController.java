package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.CustomFieldValueBatchDTO;
import com.ams.service.CustomFieldValueService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/assets")
@RequiredArgsConstructor
public class CustomFieldValueController {

    private final CustomFieldValueService customFieldValueService;

    @PreAuthorize("@ss.hasPermi('custom:value:query')")
    @GetMapping("/{assetId}/custom-fields")
    public Result<List<Map<String, Object>>> getValues(@PathVariable Long assetId) {
        return Result.success(customFieldValueService.getAssetCustomFields(assetId));
    }

    @PreAuthorize("@ss.hasPermi('custom:value:edit')")
    @PutMapping("/{assetId}/custom-fields")
    public Result<Void> saveValues(@PathVariable Long assetId,
                                    @Valid @RequestBody CustomFieldValueBatchDTO dto) {
        customFieldValueService.saveAssetCustomFields(assetId, dto);
        return Result.success("保存成功", null);
    }
}
