package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.entity.CycleCountRule;
import com.ams.entity.InventoryDetail;
import com.ams.entity.InventoryTask;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.InventoryDetailMapper;
import com.ams.mapper.InventoryTaskMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CycleCountServiceTest {

    @Mock
    private CycleCountRuleService cycleCountRuleService;

    @Mock
    private InventoryTaskMapper inventoryTaskMapper;

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private InventoryDetailMapper inventoryDetailMapper;

    @Mock
    private TenantService tenantService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void generateMonthlyTasksShouldBindAndClearTenantContext() {
        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1", "dept:2"));
        when(cycleCountRuleService.listAll()).thenAnswer(invocation -> {
            String tenantId = TenantContext.getTenantId();
            assertTrue(List.of("dept:1", "dept:2").contains(tenantId));
            return "dept:1".equals(tenantId) ? List.of(rule()) : List.of();
        });
        when(inventoryTaskMapper.selectCount(any())).thenAnswer(invocation -> {
            assertEquals("dept:1", TenantContext.getTenantId());
            return 0L;
        });
        when(assetMapper.selectList(any())).thenAnswer(invocation -> {
            assertEquals("dept:1", TenantContext.getTenantId());
            return List.of(asset());
        });
        when(inventoryTaskMapper.insert(any(InventoryTask.class))).thenAnswer(invocation -> {
            assertEquals("dept:1", TenantContext.getTenantId());
            InventoryTask task = invocation.getArgument(0);
            assertEquals("dept:1", task.getTenantId());
            assertEquals("CYCLE_COUNT", task.getInventoryType());
            task.setId(33L);
            return 1;
        });
        when(inventoryDetailMapper.insert(any(InventoryDetail.class))).thenAnswer(invocation -> {
            assertEquals("dept:1", TenantContext.getTenantId());
            InventoryDetail detail = invocation.getArgument(0);
            assertEquals("dept:1", detail.getTenantId());
            assertEquals(33L, detail.getTaskId());
            return 1;
        });

        service().generateMonthlyTasks();

        verify(cycleCountRuleService, times(2)).listAll();
        verify(inventoryTaskMapper).insert(any(InventoryTask.class));
        verify(inventoryDetailMapper).insert(any(InventoryDetail.class));
        assertNull(TenantContext.getTenantId());
    }

    private CycleCountService service() {
        return new CycleCountService(
                cycleCountRuleService,
                inventoryTaskMapper,
                assetMapper,
                inventoryDetailMapper,
                tenantService);
    }

    private CycleCountRule rule() {
        CycleCountRule rule = new CycleCountRule();
        rule.setId(9L);
        rule.setTenantId("dept:1");
        rule.setClassification("A");
        rule.setFrequency("MONTHLY");
        rule.setMinValue(BigDecimal.ONE);
        return rule;
    }

    private Asset asset() {
        Asset asset = new Asset();
        asset.setId(100L);
        asset.setTenantId("dept:1");
        asset.setAbcClassification("A");
        asset.setRfidTag("RFID-100");
        asset.setLocation("A-01");
        return asset;
    }
}
