package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.ImportExportTaskDTO;
import com.ams.service.ImportExportTaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 导入导出任务记录只读 controller。
 *
 * GET /system/import-export/tasks      任务历史列表（带租户隔离）
 * GET /system/import-export/tasks/{id} 任务详情
 * GET /system/import-export/meta       只读元数据
 *
 * 全部只读，不提供执行导入/导出的写操作（V3 只读边界）。
 */
@RestController
@RequestMapping("/system/import-export")
@RequiredArgsConstructor
public class ImportExportTaskController {

    private final ImportExportTaskService importExportTaskService;

    @GetMapping("/tasks")
    public Result<ImportExportTaskDTO.PageResult> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String taskType,
            @RequestParam(required = false) String businessObject,
            @RequestParam(required = false) String status) {
        return Result.success(importExportTaskService.list(taskType, businessObject, status, page, pageSize));
    }

    @GetMapping("/tasks/{id}")
    public Result<ImportExportTaskDTO> detail(@PathVariable Long id) {
        return Result.success(importExportTaskService.detail(id));
    }

    @GetMapping("/meta")
    public Result<ImportExportTaskDTO.Meta> meta() {
        return Result.success(importExportTaskService.meta());
    }
}
