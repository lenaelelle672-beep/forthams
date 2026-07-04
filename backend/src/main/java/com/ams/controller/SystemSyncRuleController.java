package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.SystemSyncQueueSummaryResponse;
import com.ams.dto.SystemSyncRuleRequest;
import com.ams.dto.SystemSyncRuleResponse;
import com.ams.dto.SystemSyncRunLogResponse;
import com.ams.dto.SystemSyncRunRequest;
import com.ams.service.SystemSyncExecutionService;
import com.ams.service.SystemSyncRuleService;
import com.ams.utils.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/system/sync-rules")
@RequiredArgsConstructor
public class SystemSyncRuleController {

    private final SystemSyncRuleService syncRuleService;
    private final SystemSyncExecutionService executionService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public Result<List<SystemSyncRuleResponse>> list() {
        return Result.success(syncRuleService.list());
    }

    @GetMapping("/{id}")
    public Result<SystemSyncRuleResponse> get(@PathVariable Long id) {
        return Result.success(syncRuleService.get(id));
    }

    @PostMapping
    public Result<SystemSyncRuleResponse> create(@RequestBody SystemSyncRuleRequest request,
                                                 HttpServletRequest httpRequest) {
        requireCurrentUserId(httpRequest);
        return Result.success(syncRuleService.create(request));
    }

    @PutMapping("/{id}")
    public Result<SystemSyncRuleResponse> update(@PathVariable Long id,
                                                 @RequestBody SystemSyncRuleRequest request,
                                                 HttpServletRequest httpRequest) {
        requireCurrentUserId(httpRequest);
        return Result.success(syncRuleService.update(id, request));
    }

    @PutMapping("/{id}/status")
    public Result<SystemSyncRuleResponse> updateStatus(@PathVariable Long id,
                                                       @RequestParam Boolean enabled,
                                                       HttpServletRequest httpRequest) {
        requireCurrentUserId(httpRequest);
        return Result.success(syncRuleService.updateStatus(id, Boolean.TRUE.equals(enabled)));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id, HttpServletRequest httpRequest) {
        requireCurrentUserId(httpRequest);
        syncRuleService.delete(id);
        return Result.success(null);
    }

    @PostMapping("/{id}/dry-run")
    public Result<SystemSyncRunLogResponse> dryRun(@PathVariable Long id,
                                                   @RequestBody(required = false) SystemSyncRunRequest request,
                                                   HttpServletRequest httpRequest) {
        requireCurrentUserId(httpRequest);
        return Result.success(executionService.dryRunRule(id, request));
    }

    @GetMapping("/{id}/logs")
    public Result<List<SystemSyncRunLogResponse>> logs(@PathVariable Long id) {
        return Result.success(executionService.listLogs(id));
    }

    @PostMapping("/logs/{logId}/retry")
    public Result<SystemSyncRunLogResponse> retryLog(@PathVariable Long logId, HttpServletRequest httpRequest) {
        requireCurrentUserId(httpRequest);
        return Result.success(executionService.retryLog(logId));
    }

    @GetMapping("/queue/summary")
    public Result<SystemSyncQueueSummaryResponse> queueSummary() {
        return Result.success(executionService.queueSummary());
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AccessDeniedException("缺少系统管理权限");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new AccessDeniedException("缺少系统管理权限");
        }
        return userId;
    }
}
