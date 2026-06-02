package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.WorkOrderDTO;
import com.ams.dto.DeptPendingDTO;
import com.ams.dto.StatusDistributionDTO;

import com.ams.entity.WorkOrder;
import com.ams.service.WorkOrderService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/workorders", "/work-orders"})
@RequiredArgsConstructor
public class WorkOrderController {

    private final WorkOrderService workOrderService;

    @PreAuthorize("@ss.hasPermi('workorder:order:query')")
    @GetMapping({"", "/list"})
    public Result<Page<WorkOrder>> queryWorkOrders(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return Result.success(workOrderService.queryWorkOrders(page, pageSize, status, keyword));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:query')")
    @GetMapping("/{id}")
    public Result<WorkOrder> getWorkOrderById(@PathVariable Long id) {
        return Result.success(workOrderService.getWorkOrderById(id));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:create')")
    @PostMapping
    public Result<WorkOrder> createWorkOrder(@Valid @RequestBody WorkOrderDTO dto) {
        return Result.success(workOrderService.createWorkOrder(dto));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:edit')")
    @PutMapping("/{id}")
    public Result<WorkOrder> updateWorkOrder(@PathVariable Long id, @Valid @RequestBody WorkOrderDTO dto) {
        return Result.success(workOrderService.updateWorkOrder(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> deleteWorkOrder(@PathVariable Long id) {
        workOrderService.deleteWorkOrder(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:submit')")
    @PostMapping("/{id}/submit")
    public Result<WorkOrder> submitWorkOrder(@PathVariable Long id) {
        return Result.success(workOrderService.submitWorkOrder(id));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:submit')")
    @PostMapping("/{id}/operate")
    public Result<WorkOrder> operateWorkOrder(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String operation = body.get("operation");
        String comment = body.get("comment");
        return Result.success(workOrderService.operateWorkOrder(id, operation, comment));
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:approve')")
    @PostMapping("/{id}/approve")
    public Result<WorkOrder> approveWorkOrder(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        return operateWorkOrder(id, "approve", body);
    }

    @PreAuthorize("@ss.hasPermi('workorder:order:reject')")
    @PostMapping("/{id}/reject")
    public Result<WorkOrder> rejectWorkOrder(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        return operateWorkOrder(id, "reject", body);
    }

    private Result<WorkOrder> operateWorkOrder(Long id, String operation, Map<String, String> body) {
        String comment = body != null ? body.get("comment") : null;
        return Result.success(workOrderService.operateWorkOrder(id, operation, comment));
    }

    /**
     * RPT-07: 获取工单状态分布统计。
     *
     * <p>按工单状态（已完成/进行中/待处理等）分组计数，用于工单报表饼图/柱状图。
     *
     * @return 各状态工单计数列表
     */
    @PreAuthorize("@ss.hasPermi('workorder:order:query')")
    @GetMapping("/status-distribution")
    public Result<List<StatusDistributionDTO>> getStatusDistribution() {
        return Result.success(workOrderService.getStatusDistribution());
    }

    /**
     * RPT-08: 获取各部门待处理工单数量。
     *
     * <p>按部门聚合 PENDING 状态工单计数，用于工单报表柱状图。
     *
     * @return 各部门待处理工单计数列表
     */
    @PreAuthorize("@ss.hasPermi('workorder:order:query')")
    @GetMapping("/dept-pending")
    public Result<List<DeptPendingDTO>> getDeptPending() {
        return Result.success(workOrderService.getDeptPending());
    }


}
