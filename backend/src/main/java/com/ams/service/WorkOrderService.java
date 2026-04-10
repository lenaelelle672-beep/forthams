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
```

### backend/src/main/java/com/ams/controller/WorkOrderController.java

backend/src/main/java/com/ams/controller/WorkOrderController.java
```java
<<<<<<< SEARCH
