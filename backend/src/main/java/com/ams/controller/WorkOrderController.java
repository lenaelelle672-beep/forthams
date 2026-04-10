package com.ams.controller;

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
    public ResponseEntity<WorkOrderDTO> createWorkOrder(@RequestBody WorkOrderDTO workOrderDTO) {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setStatus(workOrderDTO.getStatus());
        WorkOrder createdWorkOrder = workOrderService.createWorkOrder(workOrder);
        return ResponseEntity.ok(new WorkOrderDTO(createdWorkOrder.getId(), createdWorkOrder.getStatus()));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<WorkOrderDTO> updateStatus(@PathVariable Long id, @RequestParam String status) {
        try {
            WorkOrder updatedWorkOrder = workOrderService.updateStatus(id, status);
            return ResponseEntity.ok(new WorkOrderDTO(updatedWorkOrder.getId(), updatedWorkOrder.getStatus()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(null);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<WorkOrderDTO> getWorkOrder(@PathVariable Long id) {
        WorkOrder workOrder = workOrderService.getWorkOrder(id);
        if (workOrder == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(new WorkOrderDTO(workOrder.getId(), workOrder.getStatus()));
    }
}
