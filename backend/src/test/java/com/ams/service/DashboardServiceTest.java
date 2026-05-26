package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.dto.DashboardStatsDTO;
import com.ams.dto.DeptAssetDistributionDTO;
import com.ams.entity.Asset;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.Dept;
import com.ams.entity.InventoryTask;
import com.ams.entity.MaintenanceRecord;
import com.ams.entity.WorkOrder;
import com.ams.mapper.*;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock
    private AssetMapper assetMapper;
    @Mock
    private MaintenanceRecordMapper maintenanceRecordMapper;
    @Mock
    private ApprovalProcessMapper approvalProcessMapper;
    @Mock
    private DeptMapper deptMapper;
    @Mock
    private WorkOrderMapper workOrderMapper;
    @Mock
    private InventoryTaskMapper inventoryTaskMapper;

    @InjectMocks
    private DashboardService dashboardService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void getGlobalStats_returnsAllTenantsAggregated() {
        Asset a1 = new Asset(); a1.setTenantId("T001"); a1.setStatus("IN_USE"); a1.setOriginalValue(BigDecimal.valueOf(1000)); a1.setCurrentValue(BigDecimal.valueOf(800)); a1.setCategoryId(1L);
        Asset a2 = new Asset(); a2.setTenantId("T002"); a2.setStatus("IDLE"); a2.setOriginalValue(BigDecimal.valueOf(2000)); a2.setCurrentValue(BigDecimal.valueOf(1500)); a2.setCategoryId(2L);
        when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(a1, a2));
        when(approvalProcessMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(3L);
        when(workOrderMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(1L);
        when(inventoryTaskMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());

        DashboardStatsDTO result = dashboardService.getGlobalStats();

        assertEquals(2, result.getTotalAssets());
        assertEquals(1, result.getInUseAssets());
        assertEquals(1, result.getIdleAssets());
        assertEquals(50D, result.getUtilizationRate());
        assertEquals(BigDecimal.valueOf(3000), result.getTotalValue());
        assertEquals(BigDecimal.valueOf(2300), result.getNetValue());
        assertEquals(Long.valueOf(3), result.getPendingApprovals());
        assertEquals(Long.valueOf(1), result.getPendingWorkOrders());
        assertEquals(0D, result.getInventoryProgress());
    }

    @Test
    void getStats_returnsCurrentTenantStats() {
        Asset asset = new Asset(); asset.setTenantId("T001"); asset.setStatus("IN_USE"); asset.setOriginalValue(BigDecimal.valueOf(1000)); asset.setCurrentValue(BigDecimal.valueOf(800)); asset.setCategoryId(1L);
        when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(asset));
        when(approvalProcessMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(2L);
        when(workOrderMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        when(inventoryTaskMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());

        DashboardStatsDTO result = dashboardService.getStats();

        assertEquals(1, result.getTotalAssets());
        assertEquals(Long.valueOf(2), result.getPendingApprovals());
        assertEquals("T001", TenantContext.getTenantId());
    }

    @Test
    void getStats_whenNoTenant_returnsZero() {
        TenantContext.clear();
        DashboardStatsDTO result = dashboardService.getStats();
        assertEquals(0, result.getTotalAssets());
        assertEquals(0, result.getPendingApprovals());
    }

    @Test
    void getValueTrends_returnsDailyTrends() {
        Asset asset = new Asset(); asset.setTenantId("T001"); asset.setStatus("IN_USE"); asset.setOriginalValue(BigDecimal.valueOf(1000)); asset.setCurrentValue(BigDecimal.valueOf(800)); asset.setCategoryId(1L);
        when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(asset));

        var result = dashboardService.getValueTrends(3);

        assertEquals(3, result.size());
        result.forEach(t -> {
            assertEquals(BigDecimal.valueOf(1000), t.getTotalValue());
            assertEquals(BigDecimal.valueOf(800), t.getNetValue());
        });
    }

    @Test
    void getDeptDistribution_returnsSortedByAssetCount() {
        Asset a1 = new Asset(); a1.setTenantId("T001"); a1.setStatus("IN_USE"); a1.setDeptId(10L);
        Asset a2 = new Asset(); a2.setTenantId("T001"); a2.setStatus("IDLE"); a2.setDeptId(20L);
        Asset a3 = new Asset(); a3.setTenantId("T001"); a3.setStatus("IDLE"); a3.setDeptId(20L);
        when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(a1, a2, a3));
        lenient().when(deptMapper.selectBatchIds(any())).thenReturn(
                List.of(createDept(10L, "研发部"), createDept(20L, "生产部"))
        );

        List<DeptAssetDistributionDTO> result = dashboardService.getDeptDistribution();

        assertEquals(2, result.size());
        assertEquals("生产部", result.get(0).getDeptName());
        assertEquals(2, result.get(0).getAssetCount());
        assertEquals("研发部", result.get(1).getDeptName());
        assertEquals(1, result.get(1).getAssetCount());
    }

    @Test
    void getDeptDistribution_whenNoDept_returnsEmpty() {
        Asset asset = new Asset(); asset.setTenantId("T001"); asset.setStatus("IN_USE");
        when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(asset));

        assertTrue(dashboardService.getDeptDistribution().isEmpty());
    }

    @Test
    void getMaintenanceStats_returnsStatsForCurrentTenant() {
        Asset asset = new Asset(); asset.setId(1L); asset.setTenantId("T001"); asset.setStatus("IN_USE");
        when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(asset));
        when(maintenanceRecordMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(5L);
        when(maintenanceRecordMapper.selectMaps(any(QueryWrapper.class))).thenReturn(
                List.of(Map.of("avgCost", new BigDecimal("1200.00")))
        );
        Map<String, Object> result = dashboardService.getMaintenanceStats();

        assertEquals(5L, result.get("totalMaintenanceCount"));
        assertEquals(0, new BigDecimal("1200.00").compareTo((BigDecimal) result.get("avgMaintenanceCost")));
    }

    @Test
    void getMaintenanceStats_whenNoAssets_returnsZero() {
        TenantContext.clear();
        Map<String, Object> result = dashboardService.getMaintenanceStats();
        assertEquals(0L, result.get("totalMaintenanceCount"));
    }

    @Test
    void getMaintenanceStats_onException_returnsFallback() {
        Asset asset = new Asset(); asset.setId(1L); asset.setTenantId("T001"); asset.setStatus("IN_USE");
        when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(asset));
        when(maintenanceRecordMapper.selectCount(any(LambdaQueryWrapper.class))).thenThrow(new RuntimeException("DB error"));

        Map<String, Object> result = dashboardService.getMaintenanceStats();
        assertEquals(0, result.get("totalMaintenanceCount"));
    }

    @Test
    void getPendingApprovals_returnsCountForTenant() {
        when(approvalProcessMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(4L);
        assertEquals(Long.valueOf(4), dashboardService.getPendingApprovals());
    }

    @Test
    void getPendingApprovals_whenNoTenant_returnsZero() {
        TenantContext.clear();
        assertEquals(0L, dashboardService.getPendingApprovals());
    }

    @Test
    void buildStats_inventoryProgressCalculatesRate() {
        Asset asset = new Asset(); asset.setTenantId("T001"); asset.setStatus("IN_USE"); asset.setCategoryId(1L);
        when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(asset));
        when(approvalProcessMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        when(workOrderMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        InventoryTask task = new InventoryTask();
        task.setTotalCount(100); task.setScannedCount(35);
        when(inventoryTaskMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(task));

        DashboardStatsDTO result = dashboardService.getGlobalStats();

        assertEquals(35D, result.getInventoryProgress());
    }

    @Test
    void buildStats_criticalAlertsCountsImportantMaintenanceAndUrgentWorkOrders() {
        Asset a1 = new Asset(); a1.setTenantId("T001"); a1.setStatus("MAINTENANCE"); a1.setCategoryId(1L); a1.setIsImportant(1);
        Asset a2 = new Asset(); a2.setTenantId("T001"); a2.setStatus("IN_USE"); a2.setCategoryId(2L); a2.setIsImportant(0);
        when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(a1, a2));
        when(approvalProcessMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(0L);
        when(workOrderMapper.selectCount(any(LambdaQueryWrapper.class))).thenReturn(3L);
        when(inventoryTaskMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());

        DashboardStatsDTO result = dashboardService.getGlobalStats();

        assertEquals(4L, result.getCriticalAlerts());
    }

    private Dept createDept(Long id, String name) {
        Dept d = new Dept();
        d.setId(id);
        d.setName(name);
        return d;
    }
}
