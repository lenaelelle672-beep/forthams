package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.MailLog;
import com.ams.service.MailLogService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 邮件发送日志控制器
 */
@RestController
@RequestMapping("/mail-logs")
@RequiredArgsConstructor
public class MailLogController {

    private final MailLogService mailLogService;

    @PreAuthorize("@ss.hasPermi('mail:log:list')")
    @GetMapping("/list")
    public Result<Page<MailLog>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String templateCode,
            @RequestParam(required = false) String sendStatus,
            @RequestParam(required = false) String bizType,
            @RequestParam(required = false) Long bizId) {
        return Result.success(mailLogService.queryPage(page, pageSize, templateCode, sendStatus, bizType, bizId));
    }

    @PreAuthorize("@ss.hasPermi('mail:log:list')")
    @GetMapping("/{id}")
    public Result<MailLog> getById(@PathVariable Long id) {
        return Result.success(mailLogService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('mail:log:list')")
    @GetMapping("/biz")
    public Result<List<MailLog>> getByBiz(
            @RequestParam String bizType,
            @RequestParam Long bizId) {
        return Result.success(mailLogService.getByBiz(bizType, bizId));
    }

    @PreAuthorize("@ss.hasPermi('mail:log:retry')")
    @PostMapping("/{id}/retry")
    public Result<Void> retry(@PathVariable Long id) {
        mailLogService.retrySend(id);
        return Result.success();
    }
}
