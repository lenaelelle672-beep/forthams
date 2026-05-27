package com.ams.controller;

import com.ams.common.exception.BusinessException;
import com.ams.dto.IdleAssetCreateDTO;
import com.ams.entity.IdleAssetNotice;
import com.ams.entity.User;
import com.ams.mapper.UserMapper;
import com.ams.service.IdleAssetService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

@Slf4j
@RestController
@RequestMapping("/idle-assets")
@RequiredArgsConstructor
public class IdleAssetController {

    private final IdleAssetService idleAssetService;
    private final UserMapper userMapper;

    @PreAuthorize("@ss.hasPermi('idle:query')")
    @GetMapping("/list")
    public Result<Page<IdleAssetNotice>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(idleAssetService.queryIdleAssets(page, pageSize, null));
    }

    @PreAuthorize("@ss.hasPermi('idle:query')")
    @GetMapping("/{id}")
    public Result<IdleAssetNotice> getById(@PathVariable Long id) {
        return Result.success(idleAssetService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('idle:create')")
    @PostMapping
    public Result<IdleAssetNotice> create(@Valid @RequestBody IdleAssetCreateDTO dto) {
        return Result.success(idleAssetService.publishNotice(dto));
    }

    @PreAuthorize("@ss.hasPermi('idle:claim')")
    @PostMapping("/{id}/claim")
    public Result<IdleAssetNotice> claim(@PathVariable Long id) {
        return Result.success(idleAssetService.claimAsset(id, getCurrentUserId()));
    }

    @PreAuthorize("@ss.hasPermi('idle:cancel')")
    @PutMapping("/{id}/cancel")
    public Result<IdleAssetNotice> cancel(@PathVariable Long id) {
        return Result.success(idleAssetService.cancelNotice(id));
    }

    @PreAuthorize("@ss.hasPermi('idle:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        idleAssetService.deleteNotice(id);
        return Result.success();
    }

    /**
     * 从 Spring Security SecurityContext 中获取当前认证用户的数据库 ID。
     */
    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new BusinessException("未获取到当前用户");
        }
        String username = auth.getName();
        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>()
                        .eq(User::getUsername, username)
                        .eq(User::getStatus, 1)
                        .last("LIMIT 1")
        );
        if (user == null) {
            throw new BusinessException("未获取到当前用户");
        }
        return user.getId();
    }
}
