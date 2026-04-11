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
