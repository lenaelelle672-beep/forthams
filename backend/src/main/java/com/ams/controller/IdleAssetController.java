package com.ams.controller;

import com.ams.dto.IdleAssetCreateDTO;
import com.ams.entity.IdleAssetNotice;
import com.ams.service.IdleAssetService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
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
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(idleAssetService.queryIdleAssets(page, pageSize, null));
    }

    @GetMapping("/{id}")
    public Result<IdleAssetNotice> getById(@PathVariable Long id) {
        return Result.success(idleAssetService.getById(id));
    }

    @PostMapping
    public Result<IdleAssetNotice> create(@RequestBody IdleAssetCreateDTO dto) {
        return Result.success(idleAssetService.publishNotice(dto));
    }

    @PostMapping("/{id}/claim")
    public Result<IdleAssetNotice> claim(@PathVariable Long id) {
        return Result.success(idleAssetService.claimAsset(id, 1L));
    }

    @PutMapping("/{id}/cancel")
    public Result<IdleAssetNotice> cancel(@PathVariable Long id) {
        return Result.success(idleAssetService.cancelNotice(id));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        idleAssetService.deleteNotice(id);
        return Result.success();
    }
}
