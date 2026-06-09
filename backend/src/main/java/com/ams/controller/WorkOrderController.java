package com.ams.controller;

import com.ams.common.Result;
import com.ams.annotation.OperBusinessType;
import com.ams.annotation.OperLog;
import com.ams.dto.WorkOrderDTO;
import com.ams.dto.DeptPendingDTO;
import com.ams.dto.StatusDistributionDTO;

import com.ams.entity.WorkOrder;
import com.ams.entity.WorkOrderHoldRecord;
import com.ams.service.WorkOrderService;
import com.ams.service.WorkOrderHoldService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/workorders", "/work-orders"})
@RequiredArgsConstructor
@Tag(name = "工单管理", description = "工单 CRUD、审批流、状态转换、挂起/恢复")
public class WorkOrderController {

    private final WorkOrderService workOrderService;
    private final WorkOrderHoldService workOrderHoldService;

    @Operation(summary = "分页查询工单列表", description = "支持按状态、SLA 状态、关键词筛选")
    @PreAuthorize("@ss.hasPermi('workorder:order:query')")
    @GetMapping({"", "/list"})
    public Result<Page<WorkOrder>> queryWorkOrders(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String slaStatus,
            @RequestParam(required = false) String keyword) {
        return Result.success(workOrderService.queryWorkOrders(page, pageSize, status, slaStatus, keyword));
    }

    @Operation(summary = "获取工单详情", description = "根据 ID 获取工单完整信息")
    @PreAuthorize("@ss.hasPermi('workorder:order:query')")
    @GetMapping("/{id}")
    public Result<WorkOrder> getWorkOrderById(@PathVariable Long id) {
        return Result.success(workOrderService.getWorkOrderById(id));
    }

    @Operation(summary = "创建工单", description = "创建新的维修/保养工单")
    @PreAuthorize("@ss.hasPermi('workorder:order:create')")
    @OperLog(title = "工单新增", businessType = OperBusinessType.INSERT)
    @PostMapping
    public Result<WorkOrder> createWorkOrder(@Valid @RequestBody WorkOrderDTO dto) {
        return Result.success(workOrderService.createWorkOrder(dto));
    }

    @Operation(summary = "更新工单", description = "修改指定工单的属性信息")
    @PreAuthorize("@ss.hasPermi('workorder:order:edit')")
    @OperLog(title = "工单修改", businessType = OperBusinessType.UPDATE)
    @PutMapping("/{id}")
    public Result<WorkOrder> updateWorkOrder(@PathVariable Long id, @Valid @RequestBody WorkOrderDTO dto) {
        return Result.success(workOrderService.updateWorkOrder(id, dto));
    }

    @Operation(summary = "删除工单", description = "逻辑删除指定工单")
    @PreAuthorize("@ss.hasPermi('workorder:order:delete')")
    @OperLog(title = "工单删除", businessType = OperBusinessType.DELETE)
    @DeleteMapping("/{id}")
    public Result<Void> deleteWorkOrder(@PathVariable Long id) {
        workOrderService.deleteWorkOrder(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:submit')")
    @OperLog(title = "工单提交", businessType = OperBusinessType.UPDATE)
    @PostMapping("/{id}/submit")
    public Result<WorkOrder> submitWorkOrder(@PathVariable Long id) {
        return Result.success(workOrderService.submitWorkOrder(id));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:submit')")
    @OperLog(title = "工单操作", businessType = OperBusinessType.UPDATE)
    @PostMapping("/{id}/operate")
    public Result<WorkOrder> operateWorkOrder(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String operation = body.get("operation");
        String comment = body.get("comment");
        return Result.success(workOrderService.operateWorkOrder(id, operation, comment));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:approve')")
    @OperLog(title = "工单审批通过", businessType = OperBusinessType.UPDATE)
    @PostMapping("/{id}/approve")
    public Result<WorkOrder> approveWorkOrder(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        return operateWorkOrder(id, "approve", body);
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:reject')")
    @OperLog(title = "工单审批驳回", businessType = OperBusinessType.UPDATE)
    @PostMapping("/{id}/reject")
    public Result<WorkOrder> rejectWorkOrder(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        return operateWorkOrder(id, "reject", body);
    }

    // ── 挂起/恢复 ────────────────────────────────────────────────────────

    @PreAuthorize("@ss.hasPermi('workorder:order:hold')")
    @OperLog(title = "工单挂起", businessType = OperBusinessType.UPDATE)
    @PostMapping("/{id}/hold")
    public Result<WorkOrderHoldRecord> holdWorkOrder(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String reason = (String) body.get("reason");
        String holdEndTimeStr = (String) body.get("holdEndTime");
        LocalDateTime holdEndTime = holdEndTimeStr != null ? LocalDateTime.parse(holdEndTimeStr) : null;
        return Result.success(workOrderHoldService.hold(id, reason, holdEndTime));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:hold')")
    @OperLog(title = "工单恢复", businessType = OperBusinessType.UPDATE)
    @PostMapping("/{id}/resume")
    public Result<WorkOrderHoldRecord> resumeWorkOrder(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String note = body.get("note");
        return Result.success(workOrderHoldService.resume(id, note));
    }

    // ── 验收 ─────────────────────────────────────────────────────────────

    @PreAuthorize("@ss.hasPermi('workorder:order:edit')")
    @OperLog(title = "工单提交验收", businessType = OperBusinessType.UPDATE)
    @PostMapping("/{id}/submit-acceptance")
    public Result<WorkOrder> submitForAcceptance(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        String comment = body != null ? body.get("comment") : null;
        return Result.success(workOrderService.operateWorkOrder(id, "submit-acceptance", comment));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:approve')")
    @OperLog(title = "工单验收通过", businessType = OperBusinessType.UPDATE)
    @PostMapping("/{id}/accept")
    public Result<WorkOrder> acceptWorkOrder(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        String comment = body != null ? body.get("comment") : null;
        return Result.success(workOrderService.operateWorkOrder(id, "accept", comment));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:reject')")
    @OperLog(title = "工单验收驳回", businessType = OperBusinessType.UPDATE)
    @PostMapping("/{id}/reject-acceptance")
    public Result<WorkOrder> rejectAcceptance(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        String comment = body != null ? body.get("comment") : null;
        return Result.success(workOrderService.operateWorkOrder(id, "reject-acceptance", comment));
    }

    // ── 通用 ─────────────────────────────────────────────────────────────

    private Result<WorkOrder> operateWorkOrder(Long id, String operation, Map<String, String> body) {
        String comment = body != null ? body.get("comment") : null;
        return Result.success(workOrderService.operateWorkOrder(id, operation, comment));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:query')")
    @GetMapping("/status-distribution")
    public Result<List<StatusDistributionDTO>> getStatusDistribution() {
        return Result.success(workOrderService.getStatusDistribution());
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:query')")
    @GetMapping("/dept-pending")
    public Result<List<DeptPendingDTO>> getDeptPending() {
        return Result.success(workOrderService.getDeptPending());
    }
}
