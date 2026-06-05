package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.WorkOrderStep;
import com.ams.entity.WorkOrderTimeLog;
import com.ams.service.WorkOrderExecutionService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/workorders/{workOrderId}/execution")
@RequiredArgsConstructor
public class WorkOrderExecutionController {

    private final WorkOrderExecutionService executionService;

    // ── 工时登记 ──────────────────────────────────────────────────────────

    @PreAuthorize("@ss.hasPermi('workorder:order:edit')")
    @GetMapping("/time-logs")
    public Result<java.util.List<WorkOrderTimeLog>> getTimeLogs(@PathVariable Long workOrderId) {
        return Result.success(executionService.getTimeLogs(workOrderId));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:edit')")
    @PostMapping("/time-logs")
    public Result<WorkOrderTimeLog> createTimeLog(@PathVariable Long workOrderId, @RequestBody Map<String, Object> body) {
        Long userId = body.get("userId") != null ? Long.valueOf(body.get("userId").toString()) : 0L;
        String userName = (String) body.get("userName");

        if (Boolean.TRUE.equals(body.get("startTimer"))) {
            return Result.success(executionService.startTimer(workOrderId, userId, userName));
        }

        LocalDateTime startTime = body.get("startTime") != null ? LocalDateTime.parse((String) body.get("startTime")) : null;
        LocalDateTime endTime = body.get("endTime") != null ? LocalDateTime.parse((String) body.get("endTime")) : null;
        String description = (String) body.get("description");

        return Result.success(executionService.logTime(workOrderId, userId, userName, startTime, endTime, description));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:edit')")
    @PutMapping("/time-logs/{timeLogId}/stop")
    public Result<WorkOrderTimeLog> stopTimer(@PathVariable Long timeLogId) {
        return Result.success(executionService.stopTimer(timeLogId));
    }

    // ── 步骤Checklist ─────────────────────────────────────────────────────

    @PreAuthorize("@ss.hasPermi('workorder:order:edit')")
    @GetMapping("/steps")
    public Result<java.util.List<WorkOrderStep>> getSteps(@PathVariable Long workOrderId) {
        return Result.success(executionService.getSteps(workOrderId));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:edit')")
    @PostMapping("/steps")
    public Result<WorkOrderStep> createStep(@PathVariable Long workOrderId, @RequestBody Map<String, Object> body) {
        String stepName = (String) body.get("stepName");
        Integer stepOrder = body.get("stepOrder") != null ? Integer.valueOf(body.get("stepOrder").toString()) : 0;
        return Result.success(executionService.createStep(workOrderId, stepName, stepOrder));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:edit')")
    @PutMapping("/steps/{stepId}")
    public Result<WorkOrderStep> updateStep(@PathVariable Long stepId, @RequestBody Map<String, Object> body) {
        String stepName = (String) body.get("stepName");
        Integer stepOrder = body.get("stepOrder") != null ? Integer.valueOf(body.get("stepOrder").toString()) : null;
        return Result.success(executionService.updateStep(stepId, stepName, stepOrder));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:edit')")
    @DeleteMapping("/steps/{stepId}")
    public Result<Void> deleteStep(@PathVariable Long stepId) {
        executionService.deleteStep(stepId);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:edit')")
    @PutMapping("/steps/{stepId}/complete")
    public Result<WorkOrderStep> completeStep(@PathVariable Long stepId, @RequestBody(required = false) Map<String, Object> body) {
        Long completedBy = body != null && body.get("completedBy") != null
                ? Long.valueOf(body.get("completedBy").toString()) : 0L;
        return Result.success(executionService.completeStep(stepId, completedBy));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:edit')")
    @PutMapping("/steps/{stepId}/uncomplete")
    public Result<WorkOrderStep> uncompleteStep(@PathVariable Long stepId) {
        return Result.success(executionService.uncompleteStep(stepId));
    }

    // ── 进度 ──────────────────────────────────────────────────────────────

    @PreAuthorize("@ss.hasPermi('workorder:order:query')")
    @GetMapping("/progress")
    public Result<Map<String, Object>> getProgress(@PathVariable Long workOrderId) {
        return Result.success(executionService.getProgress(workOrderId));
    }
}
