package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.AssetCompensation;
import com.ams.service.CompensationService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/compensation", "/compensations"})
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
    public Result<?> getById(@PathVariable Long id) {
        return Result.success();
    }
}
