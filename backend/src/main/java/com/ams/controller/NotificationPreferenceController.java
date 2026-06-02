package com.ams.controller;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.ams.entity.NotificationPreference;
import com.ams.entity.User;
import com.ams.mapper.UserMapper;
import com.ams.service.NotificationPreferenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 用户通知偏好控制器
 *
 * <p>提供用户通知偏好的查询、保存、批量保存等端点。
 * 用户可在设置页面配置各通知分类的站内信和邮件接收开关。</p>
 */
@RestController
@RequestMapping("/notification-preferences")
@RequiredArgsConstructor
public class NotificationPreferenceController {

    private final NotificationPreferenceService notificationPreferenceService;
    private final UserMapper userMapper;

    /**
     * 获取所有通知偏好（供前端偏好设置页使用）
     */
    @PreAuthorize("@ss.hasPermi('notification:preference:list')")
    @GetMapping
    public Result<List<NotificationPreference>> list() {
        Long currentUserId = getCurrentUserId();
        return Result.success(notificationPreferenceService.getByUserId(currentUserId));
    }

    /**
     * 按用户ID查询偏好
     */
    @PreAuthorize("@ss.hasPermi('notification:preference:list')")
    @GetMapping("/user/{userId}")
    public Result<List<NotificationPreference>> getByUserId(@PathVariable Long userId) {
        return Result.success(notificationPreferenceService.getByUserId(userId));
    }

    /**
     * 按分类查询偏好
     */
    @PreAuthorize("@ss.hasPermi('notification:preference:list')")
    @GetMapping("/{category}")
    public Result<NotificationPreference> getByCategory(@PathVariable String category) {
        Long currentUserId = getCurrentUserId();
        return Result.success(notificationPreferenceService.getByUserAndCategory(currentUserId, category));
    }

    /**
     * 批量保存用户偏好
     */
    @PreAuthorize("@ss.hasPermi('notification:preference:edit')")
    @PutMapping("/batch")
    public Result<Void> batchSave(@RequestBody List<NotificationPreference> preferences) {
        Long currentUserId = getCurrentUserId();
        notificationPreferenceService.batchSave(currentUserId, preferences);
        return Result.success();
    }

    /**
     * 按用户ID批量保存
     */
    @PreAuthorize("@ss.hasPermi('notification:preference:edit')")
    @PutMapping("/batch/{userId}")
    public Result<Void> batchSaveByUser(@PathVariable Long userId,
                                         @RequestBody List<NotificationPreference> preferences) {
        notificationPreferenceService.batchSave(userId, preferences);
        return Result.success();
    }

    /**
     * 从 Spring Security 上下文解析当前启用用户的数据库 ID。
     */
    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new BusinessException("未获取到当前用户");
        }
        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>()
                        .eq(User::getUsername, auth.getName())
                        .eq(User::getStatus, 1)
                        .last("LIMIT 1")
        );
        if (user == null || user.getId() == null || user.getId() <= 0) {
            throw new BusinessException("未获取到当前用户");
        }
        return user.getId();
    }

    /**
     * 更新单条偏好状态
     */
    @PreAuthorize("@ss.hasPermi('notification:preference:edit')")
    @PutMapping("/{id}")
    public Result<Void> updateEnabled(@PathVariable Long id,
                                       @RequestParam(required = false) Integer inApp,
                                       @RequestParam(required = false) Integer email) {
        notificationPreferenceService.updateEnabled(id, inApp, email);
        return Result.success();
    }
}
