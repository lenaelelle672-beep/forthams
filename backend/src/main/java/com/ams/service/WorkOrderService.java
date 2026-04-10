package com.ams.service;

import com.ams.entity.WorkOrder;
import com.ams.mapper.WorkOrderMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class WorkOrderService {

    @Autowired
    private WorkOrderMapper workOrderMapper;

    public WorkOrder createWorkOrder(WorkOrder workOrder) {
        workOrder.setStatus(WorkOrder.Status.DRAFT.name());
        workOrderMapper.insert(workOrder);
        return workOrder;
    }

    public WorkOrder updateStatus(Long id, String newStatusStr) {
        WorkOrder workOrder = workOrderMapper.selectById(id);
        if (workOrder == null) {
            throw new RuntimeException("WorkOrder not found");
        }
        
        WorkOrder.Status currentStatus = WorkOrder.Status.valueOf(workOrder.getStatus());
        WorkOrder.Status newStatus = WorkOrder.Status.valueOf(newStatusStr);

        switch (newStatus) {
            case PENDING:
                if (!currentStatus.equals(WorkOrder.Status.DRAFT)) {
                    throw new IllegalArgumentException("Invalid status transition from " + currentStatus + " to " + newStatus);
                }
                break;
            case APPROVED:
                if (!currentStatus.equals(WorkOrder.Status.PENDING)) {
                    throw new IllegalArgumentException("Invalid status transition from " + currentStatus + " to " + newStatus);
                }
                break;
            case EXECUTING:
                if (!currentStatus.equals(WorkOrder.Status.APPROVED)) {
                    throw new IllegalArgumentException("Invalid status transition from " + currentStatus + " to " + newStatus);
                }
                break;
            case CLOSED:
                if (!currentStatus.equals(WorkOrder.Status.EXECUTING)) {
                    throw new IllegalArgumentException("Invalid status transition from " + currentStatus + " to " + newStatus);
                }
                break;
            default:
                throw new IllegalArgumentException("Unknown status: " + newStatus);
        }

        workOrder.setStatus(newStatus.name());
        workOrderMapper.updateById(workOrder);
        return workOrder;
    }

    public WorkOrder getWorkOrder(Long id) {
        return workOrderMapper.selectById(id);
    }
}
