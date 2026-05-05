package com.ams.service;

import com.ams.entity.ApprovalProcess;
import com.ams.entity.WorkOrder;
import com.ams.context.TenantContext;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.WorkOrderMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class WorkOrderServiceTest {

    @Mock
    private WorkOrderMapper workOrderMapper;

    @Mock
    private ApprovalProcessMapper approvalProcessMapper;

    @InjectMocks
    private WorkOrderService workOrderService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        lenient().when(workOrderMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(Collections.emptyList());
        lenient().when(approvalProcessMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(Collections.emptyList());
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldCreatePendingApprovalProcessWhenSubmittingWorkOrder() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(3L);
        workOrder.setTenantId("T001");
        workOrder.setStatus("DRAFT");
        workOrder.setReporterId(7L);
        when(workOrderMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(workOrder);

        WorkOrder result = workOrderService.submitWorkOrder(3L);

        assertEquals("PENDING", result.getStatus());
        verify(workOrderMapper).updateById(workOrder);

        ArgumentCaptor<ApprovalProcess> captor = ArgumentCaptor.forClass(ApprovalProcess.class);
        verify(approvalProcessMapper).insert(captor.capture());
        ApprovalProcess process = captor.getValue();
        assertEquals("WORK_ORDER", process.getProcessType());
        assertEquals(3L, process.getBusinessId());
        assertEquals("PENDING", process.getStatus());
        assertEquals("T001", process.getTenantId());
        assertEquals(7L, process.getApplicantId());
    }

    @Test
    void shouldAllowRejectedWorkOrderToBeSubmittedAgain() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(6L);
        workOrder.setTenantId("T001");
        workOrder.setStatus("REJECTED");
        workOrder.setReporterId(7L);
        when(workOrderMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(workOrder);

        WorkOrder result = workOrderService.submitWorkOrder(6L);

        assertEquals("PENDING", result.getStatus());
        verify(workOrderMapper).updateById(workOrder);
    }

    @Test
    void shouldAcceptUpperCaseApproveOperation() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(1L);
        workOrder.setTenantId("T001");
        workOrder.setStatus("PENDING");
        when(workOrderMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(workOrder);

        WorkOrder result = workOrderService.operateWorkOrder(1L, "APPROVE", "同意");

        assertEquals("APPROVED", result.getStatus());
        verify(workOrderMapper).updateById(workOrder);
    }

    @Test
    void shouldAcceptMixedCaseRejectOperation() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(2L);
        workOrder.setTenantId("T001");
        workOrder.setStatus("PENDING");
        when(workOrderMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(workOrder);

        WorkOrder result = workOrderService.operateWorkOrder(2L, "ReJeCt", "驳回");

        assertEquals("REJECTED", result.getStatus());
        verify(workOrderMapper).updateById(workOrder);
    }

    @Test
    void shouldRejectUpdatingPendingWorkOrder() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(4L);
        workOrder.setTenantId("T001");
        workOrder.setStatus("PENDING");
        when(workOrderMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(workOrder);

        assertThrows(com.ams.common.exception.BusinessException.class,
                () -> workOrderService.updateWorkOrder(4L, new com.ams.dto.WorkOrderDTO()));
    }

    @Test
    void shouldCancelApprovedWorkOrder() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(5L);
        workOrder.setTenantId("T001");
        workOrder.setStatus("APPROVED");
        when(workOrderMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(workOrder);

        WorkOrder result = workOrderService.operateWorkOrder(5L, "cancel", "不再执行");

        assertEquals("CANCELLED", result.getStatus());
        verify(workOrderMapper).updateById(workOrder);
    }
}
