package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.SavedReport;
import com.ams.service.DynamicReportService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/saved-reports")
@RequiredArgsConstructor
@Tag(name = "自定义报表", description = "已保存报表 CRUD 与动态执行")
public class SavedReportController {

    private final DynamicReportService dynamicReportService;

    @Operation(summary = "分页查询已保存报表列表")
    @PreAuthorize("@ss.hasPermi('saved-report:query')")
    @GetMapping
    public Result<Page<SavedReport>> list(
            @RequestParam(required = false) String reportType,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(dynamicReportService.list(reportType, keyword, pageNum, pageSize));
    }

    @Operation(summary = "获取报表详情")
    @PreAuthorize("@ss.hasPermi('saved-report:query')")
    @GetMapping("/{id}")
    public Result<SavedReport> getById(@PathVariable Long id) {
        return Result.success(dynamicReportService.getById(id));
    }

    @Operation(summary = "创建报表")
    @PreAuthorize("@ss.hasPermi('saved-report:create')")
    @PostMapping
    public Result<SavedReport> create(@Valid @RequestBody SavedReport report) {
        return Result.success(dynamicReportService.create(report));
    }

    @Operation(summary = "更新报表")
    @PreAuthorize("@ss.hasPermi('saved-report:edit')")
    @PutMapping("/{id}")
    public Result<SavedReport> update(@PathVariable Long id, @Valid @RequestBody SavedReport report) {
        return Result.success(dynamicReportService.update(id, report));
    }

    @Operation(summary = "删除报表")
    @PreAuthorize("@ss.hasPermi('saved-report:remove')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        dynamicReportService.delete(id);
        return Result.success();
    }

    @Operation(summary = "执行报表", description = "根据 savedReportId 动态执行查询并返回数据")
    @PreAuthorize("@ss.hasPermi('saved-report:query')")
    @PostMapping("/{id}/execute")
    public Result<List<Map<String, Object>>> execute(@PathVariable Long id) {
        return Result.success(dynamicReportService.executeReport(id));
    }
}
