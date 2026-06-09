package com.ams.scheduler;

import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.mapper.AssetMapper;
import com.ams.service.DepreciationService;
import com.ams.service.TenantService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DepreciationSchedulerTest {

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private DepreciationService depreciationService;

    @Mock
    private TenantService tenantService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void runDailyDepreciationShouldBindAndClearTenantContext() {
        when(tenantService.getActiveTenantIds()).thenReturn(List.of("dept:1", "dept:2"));
        when(assetMapper.selectList(any())).thenAnswer(invocation -> {
            String tenantId = TenantContext.getTenantId();
            assertTrue(List.of("dept:1", "dept:2").contains(tenantId));
            return "dept:1".equals(tenantId) ? List.of(asset()) : List.of();
        });
        when(depreciationService.calculate(any())).thenAnswer(invocation -> {
            assertEquals("dept:1", TenantContext.getTenantId());
            assertEquals(List.of(100L), invocation.getArgument(0));
            return new DepreciationService.BatchCalculateResponse(1, "折旧计算完成");
        });

        scheduler().runDailyDepreciation();

        verify(assetMapper, times(2)).selectList(any());
        verify(depreciationService).calculate(any());
        assertNull(TenantContext.getTenantId());
    }

    private DepreciationScheduler scheduler() {
        return new DepreciationScheduler(
                assetMapper,
                depreciationService,
                tenantService);
    }

    private Asset asset() {
        Asset asset = new Asset();
        asset.setId(100L);
        asset.setTenantId("dept:1");
        asset.setStatus("IN_USE");
        return asset;
    }
}
