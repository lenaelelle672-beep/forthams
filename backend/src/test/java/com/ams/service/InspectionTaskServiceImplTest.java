package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.InspectionTask;
import com.ams.entity.NotificationRecord;
import com.ams.mapper.InspectionTaskMapper;
import com.ams.service.impl.InspectionTaskServiceImpl;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InspectionTaskServiceImplTest {

    @Mock
    private InspectionTaskMapper taskMapper;

    @Mock
    private TenantService tenantService;

    @Mock
    private NotificationService notificationService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldNotifyAssignedUserForExpiringTasks() {
        InspectionTaskServiceImpl service = new InspectionTaskServiceImpl(taskMapper, tenantService, notificationService);
        InspectionTask task = new InspectionTask();
        task.setId(9L);
        task.setTaskNo("TSK-001");
        task.setTaskName("年度检验");
        task.setAssignedTo(42L);
        task.setPlannedDate(LocalDate.now().plusDays(5));

        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1"));
        when(taskMapper.findExpiringTasks("dept:1", 30)).thenAnswer(invocation -> {
            assertEquals("dept:1", TenantContext.getTenantId());
            return List.of(task);
        });

        service.remindExpiringTasks();

        ArgumentCaptor<NotificationRecord> captor = ArgumentCaptor.forClass(NotificationRecord.class);
        verify(notificationService).create(captor.capture());
        NotificationRecord notification = captor.getValue();
        assertEquals(42L, notification.getUserId());
        assertEquals("检验任务即将到期", notification.getTitle());
        assertEquals("INSPECTION_TASK", notification.getType());
        assertEquals("OPERATION", notification.getCategory());
        assertEquals(9L, notification.getRefId());
        assertEquals("INSPECTION_TASK", notification.getRefType());
        assertNull(TenantContext.getTenantId());
    }

    @Test
    void shouldMarkOverdueTasksWithinTenantContext() {
        InspectionTaskServiceImpl service = new InspectionTaskServiceImpl(taskMapper, tenantService, notificationService);
        InspectionTask task = new InspectionTask();
        task.setId(10L);
        task.setTaskNo("TSK-002");
        task.setTaskName("逾期检验");

        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1", "dept:2"));
        when(taskMapper.findOverdueTasks("dept:1")).thenAnswer(invocation -> {
            assertEquals("dept:1", TenantContext.getTenantId());
            return List.of(task);
        });
        when(taskMapper.findOverdueTasks("dept:2")).thenAnswer(invocation -> {
            assertEquals("dept:2", TenantContext.getTenantId());
            return List.of();
        });

        service.markOverdueTasks();

        ArgumentCaptor<InspectionTask> captor = ArgumentCaptor.forClass(InspectionTask.class);
        verify(taskMapper).updateById(captor.capture());
        assertEquals("OVERDUE", captor.getValue().getStatus());
        assertNull(TenantContext.getTenantId());
    }
}
