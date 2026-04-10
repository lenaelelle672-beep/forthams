package com.ams.controller;

import com.ams.entity.WorkOrder;
import com.ams.service.WorkOrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/work-orders")
public class WorkOrderController {

    @Autowired
    private WorkOrderService workOrderService;

    @PostMapping
    public WorkOrder createWorkOrder(@RequestBody WorkOrder workOrder) {
        return workOrderService.createWorkOrder(workOrder);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<WorkOrder> updateStatus(@PathVariable Long id, @RequestParam String status) {
        try {
            WorkOrder updatedWorkOrder = workOrderService.updateStatus(id, status);
            return ResponseEntity.ok(updatedWorkOrder);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(null);
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<WorkOrder> getWorkOrder(@PathVariable Long id) {
        WorkOrder workOrder = workOrderService.getWorkOrder(id);
        if (workOrder == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(workOrder);
    }
}
