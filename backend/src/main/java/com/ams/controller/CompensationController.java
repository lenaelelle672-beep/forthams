package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.AssetCompensation;
import com.ams.service.CompensationService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/compensation")
@RequiredArgsConstructor
public class CompensationController {

    private final CompensationService compensationService;

    @GetMapping("/list")
    public Result<Page<AssetCompensation>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long assetId) {
        return Result.success(compensationService.queryCompensations(page, pageSize, status, assetId));
    }

    @GetMapping("/{id}")
    public Result<AssetCompensation> getById(@PathVariable Long id) {
        return Result.success(compensationService.getById(id));
    }

    @PostMapping
    public Result<AssetCompensation> create(@RequestBody Object dto) {
        return Result.success(compensationService.createCompensation(null));
    }

    @PutMapping("/{id}")
    public Result<AssetCompensation> update(@PathVariable Long id, @RequestBody Object dto) {
        return Result.success(compensationService.updateCompensation(id, null));
    }

    @PutMapping("/{id}/status")
    public Result<AssetCompensation> updateStatus(@PathVariable Long id, @RequestParam String status) {
        return Result.success(compensationService.updateStatus(id, status));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        compensationService.deleteCompensation(id);
        return Result.success();
    }
}
