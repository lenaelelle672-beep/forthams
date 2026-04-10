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
        workOrder.setStatus("DRAFT");
        workOrderMapper.insert(workOrder);
        return workOrder;
    }

    public WorkOrder updateStatus(Long id, String newStatus) {
        WorkOrder workOrder = workOrderMapper.selectById(id);
        if (workOrder == null) {
            throw new RuntimeException("WorkOrder not found");
        }
        switch (newStatus) {
            case "PENDING":
                if (!"DRAFT".equals(workOrder.getStatus())) {
                    throw new RuntimeException("Invalid status transition");
                }
                break;
            case "APPROVED":
                if (!"PENDING".equals(workOrder.getStatus())) {
                    throw new RuntimeException("Invalid status transition");
                }
                break;
            case "EXECUTING":
                if (!"APPROVED".equals(workOrder.getStatus())) {
                    throw new RuntimeException("Invalid status transition");
                }
                break;
            case "CLOSED":
                if (!"EXECUTING".equals(workOrder.getStatus())) {
                    throw new RuntimeException("Invalid status transition");
                }
                break;
            default:
                throw new RuntimeException("Unknown status");
        }
        workOrder.setStatus(newStatus);
        workOrderMapper.updateById(workOrder);
        return workOrder;
    }

    public WorkOrder getWorkOrder(Long id) {
        return workOrderMapper.selectById(id);
    }
}
