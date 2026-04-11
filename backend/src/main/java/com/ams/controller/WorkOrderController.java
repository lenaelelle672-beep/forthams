package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.WorkOrderDTO;
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
    public ResponseEntity<Result<WorkOrderDTO>> createWorkOrder(@RequestBody WorkOrderDTO workOrderDTO) {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setStatus(WorkOrder.Status.DRAFT.name());
        Result<WorkOrder> result = workOrderService.createWorkOrder(workOrder);
        if (result.isSuccess()) {
            return ResponseEntity.ok(Result.success(new WorkOrderDTO(result.getData().getId(), result.getData().getStatus())));
        } else {
            return ResponseEntity.badRequest().body(Result.error(result.getMessage()));
        }
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<Result<WorkOrderDTO>> updateStatus(@PathVariable Long id, @RequestParam String status) {
        Result<WorkOrder> result = workOrderService.updateStatus(id, status);
        if (result.isSuccess()) {
            return ResponseEntity.ok(Result.success(new WorkOrderDTO(result.getData().getId(), result.getData().getStatus())));
        } else {
            return ResponseEntity.badRequest().body(Result.error(result.getMessage()));
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<Result<WorkOrderDTO>> getWorkOrder(@PathVariable Long id) {
        Result<WorkOrder> result = workOrderService.getWorkOrder(id);
        if (result.isSuccess()) {
            return ResponseEntity.ok(Result.success(new WorkOrderDTO(result.getData().getId(), result.getData().getStatus())));
        } else {
            return ResponseEntity.badRequest().body(Result.error(result.getMessage()));
        }
    }
}
