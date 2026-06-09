package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.Asset;
import com.ams.entity.AssetUsageLog;
import com.ams.entity.AssetUtilizationSnapshot;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.AssetUsageLogMapper;
import com.ams.mapper.AssetUtilizationSnapshotMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UtilizationServiceTest {

    @Mock
    private AssetUsageLogMapper usageLogMapper;

    @Mock
    private AssetUtilizationSnapshotMapper snapshotMapper;

    @Mock
    private AssetMapper assetMapper;

    private UtilizationService utilizationService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("dept:1");
        utilizationService = new UtilizationService(usageLogMapper, snapshotMapper, assetMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void recordUsage_shouldSetTenantOnUsageLog() {
        utilizationService.recordUsage(12L, 7L, "USE", new BigDecimal("2.50"));

        ArgumentCaptor<AssetUsageLog> captor = ArgumentCaptor.forClass(AssetUsageLog.class);
        verify(usageLogMapper).insert(captor.capture());
        AssetUsageLog log = captor.getValue();
        assertEquals("dept:1", log.getTenantId());
        assertEquals(12L, log.getAssetId());
        assertEquals(7L, log.getUserId());
        assertEquals("USE", log.getAction());
        assertEquals(new BigDecimal("2.50"), log.getDurationHours());
    }

    @Test
    void calculateMonthlySnapshot_shouldSetTenantOnSnapshots() {
        YearMonth lastMonth = YearMonth.from(LocalDate.now().minusMonths(1));
        LocalDate periodStart = lastMonth.atDay(1);
        LocalDate periodEnd = lastMonth.atEndOfMonth();

        Asset asset = new Asset();
        asset.setId(12L);
        Page<Asset> firstPage = new Page<>(1, 1000);
        firstPage.setRecords(List.of(asset));
        Page<Asset> emptyPage = new Page<>(2, 1000);
        emptyPage.setRecords(List.of());
        when(assetMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class))).thenReturn(firstPage, emptyPage);
        when(usageLogMapper.selectTotalUsage(eq(12L), eq(periodStart), eq(periodEnd)))
                .thenReturn(Map.of("totalHours", new BigDecimal("16.00")));

        utilizationService.calculateMonthlySnapshot();

        ArgumentCaptor<AssetUtilizationSnapshot> captor = ArgumentCaptor.forClass(AssetUtilizationSnapshot.class);
        verify(snapshotMapper).insert(captor.capture());
        AssetUtilizationSnapshot snapshot = captor.getValue();
        assertEquals("dept:1", snapshot.getTenantId());
        assertEquals(12L, snapshot.getAssetId());
        assertEquals("MONTHLY", snapshot.getPeriodType());
        assertEquals(periodStart, snapshot.getPeriodStart());
        assertEquals(periodEnd, snapshot.getPeriodEnd());
        assertEquals(new BigDecimal("16.00"), snapshot.getUsedHours());
    }
}
