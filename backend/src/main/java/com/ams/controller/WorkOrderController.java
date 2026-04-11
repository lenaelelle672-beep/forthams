package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.WorkOrder;
import com.ams.service.WorkOrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/work-orders")
public class WorkOrderController {

    @Autowired
    private WorkOrderService workOrderService;

    @PostMapping
    public ResponseEntity<Result<WorkOrder>> createWorkOrder(@RequestBody WorkOrder workOrder) {
        Result<WorkOrder> result = workOrderService.createWorkOrder(workOrder);
        if (result.isSuccess()) {
            return ResponseEntity.ok(result);
        } else {
            return ResponseEntity.badRequest().body(Result.error(result.getMessage()));
        }
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<Result<WorkOrder>> updateStatus(@PathVariable Long id, @RequestParam String status) {
        Result<WorkOrder> result = workOrderService.updateStatus(id, status);
        if (result.isSuccess()) {
            return ResponseEntity.ok(result);
        } else {
            return ResponseEntity.badRequest().body(Result.error(result.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Result<WorkOrder>> getWorkOrder(@PathVariable Long id) {
        Result<WorkOrder> result = workOrderService.getWorkOrder(id);
        if (result.isSuccess()) {
            return ResponseEntity.ok(result);
        } else {
            return ResponseEntity.badRequest().body(Result.error(result.getMessage()));
        }
    }
}
