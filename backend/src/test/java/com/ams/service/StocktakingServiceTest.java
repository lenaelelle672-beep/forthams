package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.StocktakingCycleStatsDTO;
import com.ams.entity.Asset;
import com.ams.entity.NotificationRecord;
import com.ams.entity.StocktakingCycle;
import com.ams.entity.StocktakingTask;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.StocktakingCycleMapper;
import com.ams.mapper.StocktakingTaskMapper;
import com.ams.service.impl.StocktakingServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StocktakingServiceTest {

    @Mock
    private StocktakingCycleMapper cycleMapper;

    @Mock
    private StocktakingTaskMapper taskMapper;

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private TenantService tenantService;

    @Mock
    private NotificationService notificationService;

    private StocktakingServiceImpl service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("dept:1");
        service = new StocktakingServiceImpl(cycleMapper, taskMapper, assetMapper, tenantService, notificationService);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldCalculateCycleStatsForCurrentTenant() {
        when(cycleMapper.selectById(7L)).thenReturn(cycle(7L, "dept:1"));
        when(taskMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(
                task(1L, "PENDING", "dept:1"),
                task(2L, "COUNTED", "dept:1"),
                task(3L, "ADJUSTED", "dept:1"),
                task(4L, "OVERDUE", "dept:1")));

        StocktakingCycleStatsDTO stats = service.getCycleStats(7L);

        assertEquals(4, stats.getTotalCount());
        assertEquals(2, stats.getPendingCount());
        assertEquals(1, stats.getCountedCount());
        assertEquals(1, stats.getAdjustedCount());
        assertEquals(2, stats.getCompletedCount());
    }

    @Test
    void shouldRejectReadingCycleFromAnotherTenant() {
        when(cycleMapper.selectById(8L)).thenReturn(cycle(8L, "dept:2"));

        assertThrows(BusinessException.class, () -> service.getCycleById(8L));
    }

    @Test
    void shouldRejectAdjustingTaskFromAnotherTenant() {
        StocktakingTask task = task(9L, "COUNTED", "dept:2");
        when(taskMapper.selectById(9L)).thenReturn(task);

        assertThrows(BusinessException.class, () -> service.adjustVariance(9L, 1000));

        verify(taskMapper, never()).updateById(any(StocktakingTask.class));
    }

    @Test
    void shouldStartCycleAsPlannedForCurrentTenant() {
        StocktakingCycle cycle = new StocktakingCycle();
        cycle.setCycleName("年度盘点");

        service.startCycle(cycle);

        ArgumentCaptor<StocktakingCycle> captor = ArgumentCaptor.forClass(StocktakingCycle.class);
        verify(cycleMapper).insert(captor.capture());
        assertEquals("dept:1", captor.getValue().getTenantId());
        assertEquals("PLANNED", captor.getValue().getStatus());
        assertEquals(0L, captor.getValue().getCreatorId());
    }

    @Test
    void shouldAssignTasksAndMoveCycleToInProgress() {
        StocktakingCycle cycle = cycle(7L, "dept:1", "PLANNED");
        when(cycleMapper.selectById(7L)).thenReturn(cycle);
        when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(
                asset(10L, "AST-A", 100L, "A"),
                asset(11L, "AST-B", 200L, "B")));

        service.assignTasks(7L, null, "ABC_LOCATION");

        ArgumentCaptor<StocktakingTask> taskCaptor = ArgumentCaptor.forClass(StocktakingTask.class);
        verify(taskMapper, times(2)).insert(taskCaptor.capture());
        assertEquals("dept:1", taskCaptor.getAllValues().get(0).getTenantId());
        assertEquals(7L, taskCaptor.getAllValues().get(0).getCycleId());
        assertEquals(10L, taskCaptor.getAllValues().get(0).getAssetId());
        assertEquals(100L, taskCaptor.getAllValues().get(0).getLocationId());
        assertEquals("PENDING", taskCaptor.getAllValues().get(0).getStatus());
        assertEquals("IN_PROGRESS", cycle.getStatus());
        verify(cycleMapper).updateById(cycle);
    }

    @Test
    void shouldPauseAndResumeCycleWithValidStatuses() {
        StocktakingCycle inProgress = cycle(7L, "dept:1", "IN_PROGRESS");
        StocktakingCycle paused = cycle(7L, "dept:1", "PAUSED");
        when(cycleMapper.selectById(7L)).thenReturn(inProgress, paused);

        service.pauseCycle(7L);
        service.resumeCycle(7L);

        ArgumentCaptor<StocktakingCycle> captor = ArgumentCaptor.forClass(StocktakingCycle.class);
        verify(cycleMapper, times(2)).updateById(captor.capture());
        assertEquals("PAUSED", captor.getAllValues().get(0).getStatus());
        assertEquals("IN_PROGRESS", captor.getAllValues().get(1).getStatus());
    }

    @Test
    void shouldRejectCompletingCycleWhenPendingTasksRemain() {
        StocktakingCycle cycle = cycle(7L, "dept:1", "IN_PROGRESS");
        when(cycleMapper.selectById(7L)).thenReturn(cycle);
        when(taskMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(2L);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.completeCycle(7L));

        assertEquals("还有 2 个任务未完成盘点，无法完成周期", ex.getMessage());
        verify(cycleMapper, never()).updateById(any(StocktakingCycle.class));
    }

    @Test
    void shouldBindAndClearTenantContextForScheduledOverdueCheck() {
        TenantContext.clear();
        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1"));
        when(taskMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class)))
                .thenAnswer(invocation -> {
                    assertEquals("dept:1", TenantContext.getTenantId());
                    Page<StocktakingTask> page = invocation.getArgument(0);
                    page.setRecords(List.of());
                    return page;
                });

        service.checkOverdueTasks();

        assertNull(TenantContext.getTenantId());
    }

    @Test
    void shouldNotifyCycleCreatorWhenScheduledTaskBecomesOverdue() {
        TenantContext.clear();
        StocktakingTask task = task(21L, "PENDING", "dept:1");
        task.setAssetId(1001L);
        StocktakingCycle cycle = cycle(7L, "dept:1", "IN_PROGRESS");
        cycle.setCreatorId(88L);
        cycle.setCycleName("二季度盘点");

        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1"));
        when(taskMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class)))
                .thenAnswer(invocation -> pageWithRecords(invocation.getArgument(0), List.of(task)))
                .thenAnswer(invocation -> pageWithRecords(invocation.getArgument(0), List.of()));
        when(cycleMapper.selectById(7L)).thenReturn(cycle);

        service.checkOverdueTasks();

        ArgumentCaptor<NotificationRecord> notificationCaptor = ArgumentCaptor.forClass(NotificationRecord.class);
        verify(taskMapper).updateById(task);
        assertEquals("OVERDUE", task.getStatus());
        verify(notificationService).create(notificationCaptor.capture());
        NotificationRecord notification = notificationCaptor.getValue();
        assertEquals(88L, notification.getUserId());
        assertEquals("盘点任务已逾期", notification.getTitle());
        assertEquals("STOCKTAKING_TASK", notification.getType());
        assertEquals("OPERATION", notification.getCategory());
        assertEquals(21L, notification.getRefId());
        assertEquals("STOCKTAKING_TASK", notification.getRefType());
        assertNull(TenantContext.getTenantId());
    }

    @Test
    void shouldKeepOverdueStatusWhenStocktakingNotificationFails() {
        TenantContext.clear();
        StocktakingTask task = task(22L, "ASSIGNED", "dept:1");
        StocktakingCycle cycle = cycle(7L, "dept:1", "IN_PROGRESS");
        cycle.setCreatorId(88L);
        cycle.setCycleName("二季度盘点");

        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1"));
        when(taskMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class)))
                .thenAnswer(invocation -> pageWithRecords(invocation.getArgument(0), List.of(task)))
                .thenAnswer(invocation -> pageWithRecords(invocation.getArgument(0), List.of()));
        when(cycleMapper.selectById(7L)).thenReturn(cycle);
        doThrow(new RuntimeException("notify failed"))
                .when(notificationService).create(any(NotificationRecord.class));

        service.checkOverdueTasks();

        verify(taskMapper).updateById(task);
        assertEquals("OVERDUE", task.getStatus());
        assertNull(TenantContext.getTenantId());
    }

    private StocktakingCycle cycle(Long id, String tenantId) {
        return cycle(id, tenantId, "IN_PROGRESS");
    }

    private StocktakingCycle cycle(Long id, String tenantId, String status) {
        StocktakingCycle cycle = new StocktakingCycle();
        cycle.setId(id);
        cycle.setTenantId(tenantId);
        cycle.setStatus(status);
        cycle.setCycleName("默认盘点");
        return cycle;
    }

    private Page<StocktakingTask> pageWithRecords(Page<StocktakingTask> page, List<StocktakingTask> records) {
        page.setRecords(records);
        return page;
    }

    private Asset asset(Long id, String assetNo, Long locationId, String abcClassification) {
        Asset asset = new Asset();
        asset.setId(id);
        asset.setAssetNo(assetNo);
        asset.setLocationId(locationId);
        asset.setAbcClassification(abcClassification);
        asset.setTenantId("dept:1");
        return asset;
    }

    private StocktakingTask task(Long id, String status, String tenantId) {
        StocktakingTask task = new StocktakingTask();
        task.setId(id);
        task.setCycleId(7L);
        task.setTenantId(tenantId);
        task.setStatus(status);
        task.setExpectedQuantity(1);
        task.setActualQuantity(1);
        task.setVariance(0);
        return task;
    }
}
