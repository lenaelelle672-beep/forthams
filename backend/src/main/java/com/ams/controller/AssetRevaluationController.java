package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.AssetRevaluationApproveDTO;
import com.ams.dto.AssetRevaluationCreateDTO;
import com.ams.dto.AssetRevaluationUpdateDTO;
import com.ams.entity.AssetRevaluation;
import com.ams.service.AssetRevaluationService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/revaluations")
@RequiredArgsConstructor
public class AssetRevaluationController {

    private final AssetRevaluationService revaluationService;

    @PreAuthorize("@ss.hasPermi('revaluation:query')")
    @GetMapping
    public Result<Page<AssetRevaluation>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long assetId) {
        return Result.success(revaluationService.getPage(page, size, status, assetId));
    }

    @PreAuthorize("@ss.hasPermi('revaluation:query')")
    @GetMapping("/{id}")
    public Result<AssetRevaluation> getById(@PathVariable Long id) {
        return Result.success(revaluationService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('revaluation:create')")
    @PostMapping
    public Result<AssetRevaluation> create(@Valid @RequestBody AssetRevaluationCreateDTO dto) {
        return Result.success(revaluationService.create(dto));
    }

    @PreAuthorize("@ss.hasPermi('revaluation:edit')")
    @PutMapping("/{id}")
    public Result<AssetRevaluation> update(@PathVariable Long id,
                                            @Valid @RequestBody AssetRevaluationUpdateDTO dto) {
        return Result.success(revaluationService.update(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('revaluation:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        revaluationService.delete(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('revaluation:approve')")
    @PostMapping("/{id}/approve")
    public Result<AssetRevaluation> approve(@PathVariable Long id,
                                            @Valid @RequestBody AssetRevaluationApproveDTO dto) {
        return Result.success(revaluationService.approve(id, dto.status(), dto.approvedBy()));
    }
}
