package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.mapper.MaintenancePlanMapper;
import com.ams.mapper.MaintenanceRecordMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MaintenancePlanServiceTest {

    @Mock
    private MaintenancePlanMapper maintenancePlanMapper;

    @Mock
    private MaintenanceRecordMapper maintenanceRecordMapper;

    @Mock
    private NotificationService notificationService;

    @Mock
    private TenantService tenantService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void scheduledGenerateRecordsShouldBindAndClearTenantContext() {
        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1", "dept:2"));
        when(maintenancePlanMapper.selectDuePlansForScheduler(anyString(), anyString(), anyString()))
                .thenAnswer(invocation -> {
                    String tenantId = invocation.getArgument(0);
                    assertEquals(tenantId, TenantContext.getTenantId());
                    assertTrue(List.of("dept:1", "dept:2").contains(tenantId));
                    return List.of();
                });

        service().scheduledGenerateRecords();

        verify(maintenancePlanMapper, times(2)).selectDuePlansForScheduler(anyString(), anyString(), anyString());
        assertNull(TenantContext.getTenantId());
    }

    @Test
    void scheduledDueReminderShouldBindAndClearTenantContext() {
        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1", "dept:2"));
        when(maintenancePlanMapper.selectUpcomingPlansForScheduler(anyString(), anyString(), anyString(), anyString()))
                .thenAnswer(invocation -> {
                    String tenantId = invocation.getArgument(0);
                    assertEquals(tenantId, TenantContext.getTenantId());
                    assertTrue(List.of("dept:1", "dept:2").contains(tenantId));
                    return List.of();
                });

        service().scheduledDueReminder();

        verify(maintenancePlanMapper, times(2)).selectUpcomingPlansForScheduler(anyString(), anyString(), anyString(), anyString());
        assertNull(TenantContext.getTenantId());
    }

    private MaintenancePlanService service() {
        return new MaintenancePlanService(
                maintenancePlanMapper,
                maintenanceRecordMapper,
                notificationService,
                tenantService);
    }
}
