package com.ams.controller;

import com.ams.common.exception.BusinessException;
import com.ams.dto.IdleAssetCreateDTO;
import com.ams.entity.IdleAssetNotice;
import com.ams.service.IdleAssetService;
import com.ams.utils.JwtUtil;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import jakarta.validation.constraints.Positive;

@RestController
@RequestMapping("/idle-assets")
@RequiredArgsConstructor
@Validated
public class IdleAssetController {

    private final IdleAssetService idleAssetService;
    private final JwtUtil jwtUtil;

    @GetMapping("/list")
    @PreAuthorize("hasAuthority('idleasset:query')")
    public Result<Page<IdleAssetNotice>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(idleAssetService.queryIdleAssets(page, pageSize, null));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('idleasset:query')")
    public Result<IdleAssetNotice> getById(@PathVariable @Positive Long id) {
        return Result.success(idleAssetService.getById(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('idleasset:create')")
    @ResponseStatus(HttpStatus.CREATED)
    public Result<IdleAssetNotice> create(@Valid @RequestBody IdleAssetCreateDTO dto) {
        return Result.success(idleAssetService.publishNotice(dto));
    }

    @PostMapping("/{id}/claim")
    @PreAuthorize("hasAuthority('idleasset:claim')")
    public Result<IdleAssetNotice> claim(@PathVariable @Positive Long id, HttpServletRequest request) {
        return Result.success(idleAssetService.claimAsset(id, getCurrentUserId(request)));
    }

    @PutMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('idleasset:update')")
    public Result<IdleAssetNotice> cancel(@PathVariable @Positive Long id) {
        return Result.success(idleAssetService.cancelNotice(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('idleasset:delete')")
    public Result<Void> delete(@PathVariable @Positive Long id) {
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
