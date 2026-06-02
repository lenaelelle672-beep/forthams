package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.NotificationBizSwitch;
import com.ams.service.NotificationBizSwitchService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 流程通知开关控制器
 */
@RestController
@RequestMapping("/notification-switches")
@RequiredArgsConstructor
public class NotificationBizSwitchController {

    private final NotificationBizSwitchService bizSwitchService;

    @PreAuthorize("@ss.hasPermi('notification:switch:list')")
    @GetMapping("/list")
    public Result<List<NotificationBizSwitch>> list() {
        return Result.success(bizSwitchService.getAll());
    }

    @PreAuthorize("@ss.hasPermi('notification:switch:list')")
    @GetMapping("/biz-type/{bizType}")
    public Result<List<NotificationBizSwitch>> getByBizType(@PathVariable String bizType) {
        return Result.success(bizSwitchService.getByBizType(bizType));
    }

    @PreAuthorize("@ss.hasPermi('notification:switch:edit')")
    @PutMapping("/{id}")
    public Result<Void> updateEnabled(@PathVariable Long id, @RequestParam Integer enabled) {
        bizSwitchService.updateEnabled(id, enabled);
        return Result.success();
    }
}
