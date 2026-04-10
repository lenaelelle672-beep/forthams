package com.ams.service;

import com.ams.common.Result;
import com.ams.entity.WorkOrder;
import com.ams.mapper.WorkOrderMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class WorkOrderService {

    @Autowired
    private WorkOrderMapper workOrderMapper;

    public Result<WorkOrder> createWorkOrder(WorkOrder workOrder) {
        workOrder.setStatus(WorkOrder.Status.DRAFT.name());
        workOrderMapper.insert(workOrder);
        return Result.success(workOrder);
    }

    public Result<WorkOrder> updateStatus(Long id, String newStatusStr) {
        WorkOrder workOrder = workOrderMapper.selectById(id);
        if (workOrder == null) {
            return Result.error("WorkOrder not found");
        }
    
        WorkOrder.Status currentStatus = WorkOrder.Status.valueOf(workOrder.getStatus());
        WorkOrder.Status newStatus = WorkOrder.Status.valueOf(newStatusStr);

        switch (newStatus) {
            case PENDING:
                if (!currentStatus.equals(WorkOrder.Status.DRAFT)) {
                    return Result.error("Invalid status transition from " + currentStatus + " to " + newStatus);
                }
                break;
            case APPROVED:
                if (!currentStatus.equals(WorkOrder.Status.PENDING)) {
                    return Result.error("Invalid status transition from " + currentStatus + " to " + newStatus);
                }
                break;
            case EXECUTING:
                if (!currentStatus.equals(WorkOrder.Status.APPROVED)) {
                    return Result.error("Invalid status transition from " + currentStatus + " to " + newStatus);
                }
                break;
            case CLOSED:
                if (!currentStatus.equals(WorkOrder.Status.EXECUTING)) {
                    return Result.error("Invalid status transition from " + currentStatus + " to " + newStatus);
                }
                break;
            default:
                return Result.error("Unknown status: " + newStatus);
        }

        workOrder.setStatus(newStatus.name());
        workOrderMapper.updateById(workOrder);
        return Result.success(workOrder);
    }

    public Result<WorkOrder> getWorkOrder(Long id) {
        WorkOrder workOrder = workOrderMapper.selectById(id);
        if (workOrder == null) {
            return Result.error("WorkOrder not found");
        }
        return Result.success(workOrder);
    }
}
```

### backend/src/main/java/com/ams/controller/WorkOrderController.java

backend/src/main/java/com/ams/controller/WorkOrderController.java
```java
<<<<<<< SEARCH
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
