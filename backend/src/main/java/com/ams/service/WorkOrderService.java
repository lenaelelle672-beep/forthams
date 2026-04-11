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
        if (workOrder.getStatus() == null || !workOrder.getStatus().equals(WorkOrder.Status.DRAFT.name())) {
            return Result.error("Initial status must be DRAFT");
        }
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
        switch (currentStatus) {
            case DRAFT:
                return newStatus == WorkOrder.Status.PENDING;
            case PENDING:
                return newStatus == WorkOrder.Status.APPROVED;
            case APPROVED:
                return newStatus == WorkOrder.Status.EXECUTING;
            case EXECUTING:
                return newStatus == WorkOrder.Status.CLOSED;
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
