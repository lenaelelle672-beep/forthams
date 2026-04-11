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

        if (!isValidTransition(currentStatus, newStatus)) {
            return Result.error("Invalid status transition from " + currentStatus + " to " + newStatus);
        }

        workOrder.setStatus(newStatus.name());
        workOrderMapper.updateById(workOrder);
        return Result.success(workOrder);
    }

    private boolean isValidTransition(WorkOrder.Status currentStatus, WorkOrder.Status newStatus) {
        switch (newStatus) {
            case PENDING:
                return currentStatus.equals(WorkOrder.Status.DRAFT);
            case APPROVED:
                return currentStatus.equals(WorkOrder.Status.PENDING);
            case EXECUTING:
                return currentStatus.equals(WorkOrder.Status.APPROVED);
            case CLOSED:
                return currentStatus.equals(WorkOrder.Status.EXECUTING);
            default:
                return false;
        }
    }

    public Result<WorkOrder> getWorkOrder(Long id) {
        WorkOrder workOrder = workOrderMapper.selectById(id);
        if (workOrder == null) {
            return Result.error("WorkOrder not found");
        }
        return Result.success(workOrder);
    }
}

### backend/src/main/java/com/ams/controller/WorkOrderController.java

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
