package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.WorkOrderDTO;
import com.ams.dto.WorkOrderCommentDTO;
import com.ams.dto.WorkOrderOperationDTO;
import com.ams.entity.WorkOrder;
import com.ams.enums.WorkOrderStatus;
import com.ams.service.WorkOrderService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;

@RestController
@RequestMapping({"/workorders", "/work-orders", "/v1/workorders", "/v1/work-orders"})
@RequiredArgsConstructor
@Validated
public class WorkOrderController {

    private final WorkOrderService workOrderService;

    @GetMapping({"", "/list"})
    @PreAuthorize("hasAuthority('workorder:query')")
    public Result<Page<WorkOrder>> queryWorkOrders(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) WorkOrderStatus status,
            @RequestParam(required = false) String keyword) {
        return Result.success(workOrderService.queryWorkOrders(
                page, pageSize, status == null ? null : status.name(), keyword));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('workorder:query')")
    public Result<WorkOrder> getWorkOrderById(@PathVariable Long id) {
        return Result.success(workOrderService.getWorkOrderById(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('workorder:create')")
    @ResponseStatus(HttpStatus.CREATED)
    public Result<WorkOrder> createWorkOrder(@Valid @RequestBody WorkOrderDTO dto) {
        return Result.success(workOrderService.createWorkOrder(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('workorder:update')")
    public Result<WorkOrder> updateWorkOrder(@PathVariable @Positive Long id, @Valid @RequestBody WorkOrderDTO dto) {
        return Result.success(workOrderService.updateWorkOrder(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('workorder:delete')")
    public Result<Void> deleteWorkOrder(@PathVariable @Positive Long id) {
        workOrderService.deleteWorkOrder(id);
        return Result.success();
    }

    @PostMapping("/{id}/submit")
    @PreAuthorize("hasAuthority('workorder:submit')")
    public Result<WorkOrder> submitWorkOrder(@PathVariable @Positive Long id) {
        return Result.success(workOrderService.submitWorkOrder(id));
    }

    @PostMapping("/{id}/operate")
    @PreAuthorize("hasAnyAuthority('workorder:approve', 'workorder:execute', 'workorder:cancel')")
    public Result<WorkOrder> operateWorkOrder(@PathVariable @Positive Long id, @Valid @RequestBody WorkOrderOperationDTO body) {
        return Result.success(workOrderService.operateWorkOrder(id, body.getOperation().name(), body.getComment()));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('workorder:approve')")
    public Result<WorkOrder> approveWorkOrder(@PathVariable @Positive Long id,
                                               @Valid @RequestBody(required = false) WorkOrderCommentDTO body) {
        throw directApprovalDisabled();
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAuthority('workorder:approve')")
    public Result<WorkOrder> rejectWorkOrder(@PathVariable @Positive Long id,
                                              @Valid @RequestBody(required = false) WorkOrderCommentDTO body) {
        throw directApprovalDisabled();
    }

    private AccessDeniedException directApprovalDisabled() {
        return new AccessDeniedException("工单审批必须通过受控审批流程处理");
    }
}
