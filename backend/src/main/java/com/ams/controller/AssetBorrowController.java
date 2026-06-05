package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.AssetBorrowCreateDTO;
import com.ams.dto.AssetBorrowQueryDTO;
import com.ams.dto.AssetBorrowUpdateDTO;
import com.ams.entity.AssetBorrow;
import com.ams.service.AssetBorrowService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * 借用管理 REST 控制器。
 */
@RestController
@RequestMapping("/borrows")
@RequiredArgsConstructor
public class AssetBorrowController {

    private final AssetBorrowService borrowService;

    @PreAuthorize("@ss.hasPermi('asset:borrow:query')")
    @GetMapping
    public Result<Page<AssetBorrow>> list(AssetBorrowQueryDTO queryDTO) {
        return Result.success(borrowService.queryPage(queryDTO));
    }

    @PreAuthorize("@ss.hasPermi('asset:borrow:query')")
    @GetMapping("/{id}")
    public Result<AssetBorrow> getById(@PathVariable Long id) {
        return Result.success(borrowService.getDetail(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:borrow:create')")
    @PostMapping
    public Result<AssetBorrow> create(@Valid @RequestBody AssetBorrowCreateDTO dto) {
        return Result.success(borrowService.create(dto));
    }

    @PreAuthorize("@ss.hasPermi('asset:borrow:edit')")
    @PutMapping("/{id}")
    public Result<AssetBorrow> update(@PathVariable Long id, @Valid @RequestBody AssetBorrowUpdateDTO dto) {
        return Result.success(borrowService.update(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('asset:borrow:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        borrowService.delete(id);
        return Result.success();
    }

    // ── 状态流转 ─────────────────────────────────────────────────────────────

    @PreAuthorize("@ss.hasPermi('asset:borrow:edit')")
    @PostMapping("/{id}/submit")
    public Result<AssetBorrow> submit(@PathVariable Long id) {
        return Result.success(borrowService.submit(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:borrow:approve')")
    @PostMapping("/{id}/approve")
    public Result<AssetBorrow> approve(@PathVariable Long id) {
        return Result.success(borrowService.approve(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:borrow:approve')")
    @PostMapping("/{id}/reject")
    public Result<AssetBorrow> reject(@PathVariable Long id, @RequestParam(required = false) String reason) {
        return Result.success(borrowService.reject(id, reason));
    }

    @PreAuthorize("@ss.hasPermi('asset:borrow:edit')")
    @PostMapping("/{id}/borrow")
    public Result<AssetBorrow> borrow(@PathVariable Long id) {
        return Result.success(borrowService.borrow(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:borrow:edit')")
    @PostMapping("/{id}/return")
    public Result<AssetBorrow> returnAsset(@PathVariable Long id, @RequestParam(required = false) String remark) {
        return Result.success(borrowService.returnAsset(id, remark));
    }

    @PreAuthorize("@ss.hasPermi('asset:borrow:edit')")
    @PostMapping("/{id}/cancel")
    public Result<AssetBorrow> cancel(@PathVariable Long id) {
        return Result.success(borrowService.cancel(id));
    }
}
