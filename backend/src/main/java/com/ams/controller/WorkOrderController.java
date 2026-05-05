package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.WorkOrderDTO;
import com.ams.entity.WorkOrder;
import com.ams.service.WorkOrderService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping({"/workorders", "/work-orders", "/v1/workorders", "/v1/work-orders"})
@RequiredArgsConstructor
public class WorkOrderController {

    private final WorkOrderService workOrderService;

    @GetMapping({"", "/list"})
    public Result<Page<WorkOrder>> queryWorkOrders(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return Result.success(workOrderService.queryWorkOrders(page, pageSize, status, keyword));
    }

    @GetMapping("/{id}")
    public Result<WorkOrder> getWorkOrderById(@PathVariable Long id) {
        return Result.success(workOrderService.getWorkOrderById(id));
    }

    @PostMapping
    public Result<WorkOrder> createWorkOrder(@RequestBody WorkOrderDTO dto) {
        return Result.success(workOrderService.createWorkOrder(dto));
    }

    @PutMapping("/{id}")
    public Result<WorkOrder> updateWorkOrder(@PathVariable Long id, @RequestBody WorkOrderDTO dto) {
        return Result.success(workOrderService.updateWorkOrder(id, dto));
    }

    @DeleteMapping("/{id}")
    public Result<Void> deleteWorkOrder(@PathVariable Long id) {
        workOrderService.deleteWorkOrder(id);
        return Result.success();
    }

    @PostMapping("/{id}/submit")
    public Result<WorkOrder> submitWorkOrder(@PathVariable Long id) {
        return Result.success(workOrderService.submitWorkOrder(id));
    }

    @PostMapping("/{id}/operate")
    public Result<WorkOrder> operateWorkOrder(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String operation = body.get("operation");
        String comment = body.get("comment");
        return Result.success(workOrderService.operateWorkOrder(id, operation, comment));
    }

    @PostMapping("/{id}/approve")
    public Result<WorkOrder> approveWorkOrder(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        return operateWorkOrder(id, "approve", body);
    }

    @PostMapping("/{id}/reject")
    public Result<WorkOrder> rejectWorkOrder(@PathVariable Long id, @RequestBody(required = false) Map<String, String> body) {
        return operateWorkOrder(id, "reject", body);
    }

    private Result<WorkOrder> operateWorkOrder(Long id, String operation, Map<String, String> body) {
        String comment = body != null ? body.get("comment") : null;
        return Result.success(workOrderService.operateWorkOrder(id, operation, comment));
    }
}
