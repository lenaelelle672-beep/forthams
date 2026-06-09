package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.User;
import com.ams.entity.WorkOrder;
import com.ams.entity.WorkOrderHoldRecord;
import com.ams.mapper.UserMapper;
import com.ams.mapper.WorkOrderHoldRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WorkOrderHoldServiceTest {

    @Mock
    private WorkOrderHoldRecordMapper workOrderHoldRecordMapper;

    @Mock
    private WorkOrderService workOrderService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private TenantService tenantService;

    @Mock
    private UserMapper userMapper;

    private WorkOrderHoldService service;

    @BeforeEach
    void setUp() {
        service = new WorkOrderHoldService(
                workOrderHoldRecordMapper,
                workOrderService,
                notificationService,
                tenantService,
                userMapper);
        TenantContext.setTenantId("dept:1");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("alice", null, List.of()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    void shouldPersistCurrentUserIdWhenHoldingWorkOrder() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(7L);
        workOrder.setTenantId("dept:1");
        workOrder.setStatus("EXECUTING");
        when(workOrderService.getWorkOrder(7L)).thenReturn(workOrder);
        when(workOrderHoldRecordMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user(42L));

        LocalDateTime holdEndTime = LocalDateTime.now().plusHours(2);
        service.hold(7L, "等待备件", holdEndTime);

        ArgumentCaptor<WorkOrderHoldRecord> captor = ArgumentCaptor.forClass(WorkOrderHoldRecord.class);
        verify(workOrderHoldRecordMapper).insert(captor.capture());
        WorkOrderHoldRecord record = captor.getValue();
        assertEquals(7L, record.getWorkOrderId());
        assertEquals(42L, record.getHeldBy());
        assertEquals("dept:1", record.getTenantId());
        assertEquals(holdEndTime, record.getHoldEndTime());
        verify(workOrderService).operateWorkOrder(7L, "hold", "等待备件");
    }

    @Test
    void shouldPersistCurrentUserIdWhenResumingWorkOrder() {
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(8L);
        workOrder.setTenantId("dept:1");
        workOrder.setStatus("ON_HOLD");
        when(workOrderService.getWorkOrder(8L)).thenReturn(workOrder);

        WorkOrderHoldRecord activeRecord = new WorkOrderHoldRecord();
        activeRecord.setId(99L);
        activeRecord.setWorkOrderId(8L);
        activeRecord.setTenantId("dept:1");
        when(workOrderHoldRecordMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(activeRecord);
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user(43L));

        service.resume(8L, "已到货");

        ArgumentCaptor<WorkOrderHoldRecord> captor = ArgumentCaptor.forClass(WorkOrderHoldRecord.class);
        verify(workOrderHoldRecordMapper).updateById(captor.capture());
        WorkOrderHoldRecord record = captor.getValue();
        assertEquals(99L, record.getId());
        assertEquals(43L, record.getResumedBy());
        verify(workOrderService).operateWorkOrder(8L, "resume", "已到货");
    }

    private static User user(Long id) {
        User user = new User();
        user.setId(id);
        user.setUsername("alice");
        user.setStatus(1);
        return user;
    }
}
