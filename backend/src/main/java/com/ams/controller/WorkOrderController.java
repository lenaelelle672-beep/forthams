package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.WorkOrder;
import com.ams.service.WorkOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/workorders")
@RequiredArgsConstructor
public class WorkOrderController {
    private final WorkOrderService workOrderService;

    @GetMapping("/list")
    public Result<Map<String, Object>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        Map<String, Object> result = new HashMap<>();
        result.put("records", java.util.Collections.emptyList());
        result.put("total", 0);
        return Result.success(result);
    }

    @GetMapping("/{id}")
    public Result<WorkOrder> getById(@PathVariable Long id) {
        return workOrderService.getWorkOrder(id);
    }

    @PostMapping
    public Result<WorkOrder> create(@RequestBody WorkOrder workOrder) {
        return workOrderService.createWorkOrder(workOrder);
    }
}
