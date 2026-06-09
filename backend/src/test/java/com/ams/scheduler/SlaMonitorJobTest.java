package com.ams.scheduler;

import com.ams.context.TenantContext;
import com.ams.mapper.WorkOrderMapper;
import com.ams.service.NotificationService;
import com.ams.service.SlaService;
import com.ams.service.TenantService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SlaMonitorJobTest {

    @Mock
    private SlaService slaService;

    @Mock
    private WorkOrderMapper workOrderMapper;

    @Mock
    private NotificationService notificationService;

    @Mock
    private TenantService tenantService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldBindAndClearTenantContextForEachActiveTenant() {
        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1", "dept:2"));
        when(workOrderMapper.selectList(any(QueryWrapper.class))).thenAnswer(invocation -> {
            assertTrue(List.of("dept:1", "dept:2").contains(TenantContext.getTenantId()));
            return List.of();
        });
        doAnswer(invocation -> {
            assertTrue(List.of("dept:1", "dept:2").contains(TenantContext.getTenantId()));
            return 1;
        }).when(slaService).refreshAllSlaStatuses();

        new SlaMonitorJob(slaService, workOrderMapper, notificationService, tenantService)
                .refreshSlaStatuses();

        verify(slaService, times(2)).refreshAllSlaStatuses();
        verify(workOrderMapper, times(4)).selectList(any(QueryWrapper.class));
        assertNull(TenantContext.getTenantId());
    }
}
