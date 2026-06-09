package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.entity.InventoryAdjustmentLog;
import com.ams.entity.InventoryDetail;
import com.ams.entity.InventoryTask;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.InventoryAdjustmentLogMapper;
import com.ams.mapper.InventoryDetailMapper;
import com.ams.mapper.InventoryTaskMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InventoryServiceTest {

    @Mock
    private InventoryTaskMapper inventoryTaskMapper;

    @Mock
    private InventoryDetailMapper inventoryDetailMapper;

    @Mock
    private InventoryAdjustmentLogMapper inventoryAdjustmentLogMapper;

    @Mock
    private AssetMapper assetMapper;

    @InjectMocks
    private InventoryService inventoryService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("dept:1");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldConfirmInventoryDetailWithinTaskTenantScope() {
        InventoryTask task = task("COMPLETED");
        InventoryDetail detail = detail(11L, 7L, null, "normal");
        when(inventoryTaskMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(task);
        when(inventoryDetailMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(detail);

        InventoryDetail result = inventoryService.confirmAsset(7L, 11L, "damaged", "屏幕破损");

        assertEquals("damaged", result.getStatus());
        assertEquals("屏幕破损", result.getRemark());
        verify(inventoryDetailMapper).updateById(detail);
    }

    @Test
    void shouldApproveTaskWithTenantSafeAdjustmentAndAuditLogs() {
        InventoryTask task = task("PENDING_APPROVAL");
        InventoryDetail surplus = detail(11L, 7L, null, "surplus");
        surplus.setRemark("盘盈投影仪");
        surplus.setActualLocation("A-101");
        InventoryDetail deficit = detail(12L, 7L, 100L, "deficit");
        InventoryDetail damaged = detail(13L, 7L, 101L, "damaged");
        Asset lostAsset = asset(100L, "AS-100", "旧显示器", "IN_USE");
        Asset damagedAsset = asset(101L, "AS-101", "会议屏", "IN_USE");

        when(inventoryTaskMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(task);
        when(inventoryDetailMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(surplus, deficit, damaged));
        when(assetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(lostAsset, damagedAsset);
        doAnswer(invocation -> {
            Asset inserted = invocation.getArgument(0);
            inserted.setId(200L);
            return 1;
        }).when(assetMapper).insert(any(Asset.class));

        Map<String, Object> result = inventoryService.approveTask(7L);

        assertEquals(1, result.get("surplusCreated"));
        assertEquals(1, result.get("deficitMarked"));
        assertEquals(1, result.get("damagedMarked"));
        assertEquals("APPROVED", task.getStatus());
        assertEquals("LOST", lostAsset.getStatus());
        assertEquals("MAINTENANCE", damagedAsset.getStatus());
        verify(assetMapper).insert(any(Asset.class));
        verify(assetMapper, times(2)).updateById(any(Asset.class));
        verify(inventoryTaskMapper).updateById(task);

        ArgumentCaptor<InventoryAdjustmentLog> logCaptor = ArgumentCaptor.forClass(InventoryAdjustmentLog.class);
        verify(inventoryAdjustmentLogMapper, times(3)).insert(logCaptor.capture());
        List<String> adjustmentTypes = logCaptor.getAllValues().stream()
                .map(InventoryAdjustmentLog::getAdjustmentType)
                .toList();
        assertEquals(List.of("SURPLUS", "DEFICIT", "DAMAGE"), adjustmentTypes);
    }

    private InventoryTask task(String status) {
        InventoryTask task = new InventoryTask();
        task.setId(7L);
        task.setTenantId("dept:1");
        task.setStatus(status);
        return task;
    }

    private InventoryDetail detail(Long id, Long taskId, Long assetId, String status) {
        InventoryDetail detail = new InventoryDetail();
        detail.setId(id);
        detail.setTaskId(taskId);
        detail.setTenantId("dept:1");
        detail.setAssetId(assetId);
        detail.setStatus(status);
        return detail;
    }

    private Asset asset(Long id, String assetNo, String assetName, String status) {
        Asset asset = new Asset();
        asset.setId(id);
        asset.setTenantId("dept:1");
        asset.setAssetNo(assetNo);
        asset.setAssetName(assetName);
        asset.setStatus(status);
        return asset;
    }
}
