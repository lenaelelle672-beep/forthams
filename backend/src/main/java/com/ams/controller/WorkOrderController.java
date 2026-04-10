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
    public WorkOrder updateStatus(@PathVariable Long id, @RequestParam String status) {
        return workOrderService.updateStatus(id, status);
    }

    @GetMapping("/{id}")
    public WorkOrder getWorkOrder(@PathVariable Long id) {
        return workOrderService.getWorkOrder(id);
    }
}
