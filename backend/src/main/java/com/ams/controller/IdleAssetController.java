package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.IdleAssetCreateDTO;
import com.ams.entity.IdleAssetNotice;
import com.ams.service.IdleAssetService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/idle-assets")
@RequiredArgsConstructor
public class IdleAssetController {

    private final IdleAssetService idleAssetService;

    @GetMapping("/list")
    public Result<Page<IdleAssetNotice>> list(
        @RequestParam(defaultValue = "1") Integer page,
        @RequestParam(defaultValue = "10") Integer pageSize,
        @RequestParam(required = false) String status
    ) {
        return Result.success(idleAssetService.queryIdleAssets(page, pageSize, status));
    }

    @GetMapping("/{id}")
    public Result<IdleAssetNotice> getById(@PathVariable Long id) {
        return Result.success(idleAssetService.getById(id));
    }

    @PostMapping
    public Result<IdleAssetNotice> create(@Valid @RequestBody IdleAssetCreateDTO dto) {
        return Result.success("创建成功", idleAssetService.publishNotice(dto));
    }

    @PostMapping("/{id}/claim")
    public Result<IdleAssetNotice> claim(@PathVariable Long id, @RequestParam Long claimantId) {
        return Result.success("认领成功", idleAssetService.claimAsset(id, claimantId));
    }

    @PutMapping("/{id}/cancel")
    public Result<IdleAssetNotice> cancel(@PathVariable Long id) {
        return Result.success("取消成功", idleAssetService.cancelNotice(id));
    }

    @DeleteMapping("/{id}")
    public Result<String> delete(@PathVariable Long id) {
        idleAssetService.deleteNotice(id);
        return Result.success("删除成功");
    }
}
