package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.ScheduledReport;
import com.ams.service.ScheduledReportService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/scheduled-reports")
@RequiredArgsConstructor
@Tag(name = "定时报表", description = "定时报表配置，支持 CRON 表达式和邮件推送")
public class ScheduledReportController {

    private final ScheduledReportService scheduledReportService;

    @Operation(summary = "分页查询定时报表列表")
    @PreAuthorize("@ss.hasPermi('scheduled-report:query')")
    @GetMapping
    public Result<Page<ScheduledReport>> list(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return Result.success(scheduledReportService.list(pageNum, pageSize, status, keyword));
    }

    @Operation(summary = "获取定时报表详情")
    @PreAuthorize("@ss.hasPermi('scheduled-report:query')")
    @GetMapping("/{id}")
    public Result<ScheduledReport> getById(@PathVariable Long id) {
        return Result.success(scheduledReportService.getById(id));
    }

    @Operation(summary = "创建定时报表")
    @PreAuthorize("@ss.hasPermi('scheduled-report:create')")
    @PostMapping
    public Result<ScheduledReport> create(@Valid @RequestBody ScheduledReport report) {
        return Result.success(scheduledReportService.create(report));
    }

    @Operation(summary = "更新定时报表")
    @PreAuthorize("@ss.hasPermi('scheduled-report:edit')")
    @PutMapping("/{id}")
    public Result<ScheduledReport> update(@PathVariable Long id, @Valid @RequestBody ScheduledReport report) {
        return Result.success(scheduledReportService.update(id, report));
    }

    @Operation(summary = "删除定时报表")
    @PreAuthorize("@ss.hasPermi('scheduled-report:remove')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        scheduledReportService.delete(id);
        return Result.success();
    }

    @Operation(summary = "切换启用/暂停状态")
    @PreAuthorize("@ss.hasPermi('scheduled-report:edit')")
    @PutMapping("/{id}/toggle")
    public Result<ScheduledReport> toggleStatus(@PathVariable Long id) {
        return Result.success(scheduledReportService.toggleStatus(id));
    }
}
