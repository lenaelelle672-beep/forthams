package com.ams.service;

import com.ams.entity.ApprovalProcess;
import com.ams.entity.ApprovalRecord;
import com.ams.context.TenantContext;
import com.ams.mapper.ApprovalProcessMapper;
import com.ams.mapper.ApprovalRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentCaptor.forClass;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApprovalServiceTest {

    @Mock
    private ApprovalProcessMapper approvalProcessMapper;

    @Mock
    private ApprovalRecordMapper approvalRecordMapper;

    @Mock
    private RetirementApplicationService retirementApplicationService;

    @Mock
    private WorkOrderService workOrderService;

    @InjectMocks
    private ApprovalService approvalService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldCompleteWorkOrderApprovalInOneStepAndUpdateWorkOrder() {
        ApprovalProcess process = new ApprovalProcess();
        process.setId(5L);
        process.setTenantId("T001");
        process.setProcessType("WORK_ORDER");
        process.setBusinessId(9L);
        process.setStatus("PENDING");
        process.setCurrentStep(1);
        when(approvalProcessMapper.selectOne(any(QueryWrapper.class))).thenReturn(process);

        ApprovalProcess result = approvalService.approve(5L, 42L, "APPROVED", "ok");

        assertEquals("APPROVED", result.getStatus());
        var recordCaptor = forClass(ApprovalRecord.class);
        verify(approvalRecordMapper).insert(recordCaptor.capture());
        assertEquals("T001", recordCaptor.getValue().getTenantId());
        verify(approvalProcessMapper).updateById(process);
        verify(workOrderService).applyApprovalOutcome(9L, "APPROVED", "ok");
    }
}
