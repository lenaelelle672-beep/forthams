package com.ams.controller;

import com.ams.common.exception.BusinessException;
import com.ams.dto.IdleAssetCreateDTO;
import com.ams.entity.IdleAssetNotice;
import com.ams.service.IdleAssetService;
import com.ams.utils.JwtUtil;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/idle-assets")
@RequiredArgsConstructor
public class IdleAssetController {

    private final IdleAssetService idleAssetService;
    private final JwtUtil jwtUtil;

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
    public Result<IdleAssetNotice> claim(@PathVariable Long id, HttpServletRequest request) {
        return Result.success(idleAssetService.claimAsset(id, getCurrentUserId(request)));
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

    private Long getCurrentUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new BusinessException("未获取到当前用户");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new BusinessException("未获取到当前用户");
        }
        return userId;
    }
}
