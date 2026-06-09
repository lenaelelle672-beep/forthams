package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.*;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.EnergyConsumptionMapper;
import com.ams.mapper.EnergyMeterMapper;
import com.ams.mapper.LocationMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Month;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EnergyServiceTest {

    @Mock
    private EnergyMeterMapper energyMeterMapper;
    @Mock
    private EnergyConsumptionMapper energyConsumptionMapper;
    @Mock
    private LocationMapper locationMapper;
    @Mock
    private LocationService locationService;
    @Mock
    private AssetMapper assetMapper;

    private EnergyService energyService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("dept:1");
        // 初始化 MyBatis-Plus 实体元数据：LambdaQueryWrapper 解析方法引用需要 TableInfo 缓存
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(new MybatisConfiguration(), "");
        TableInfoHelper.initTableInfo(assistant, Asset.class);
        TableInfoHelper.initTableInfo(assistant, EnergyMeter.class);
        TableInfoHelper.initTableInfo(assistant, EnergyConsumption.class);
        // 显式构造，避免 @InjectMocks 漏注入 assetMapper（与本仓其它 service 单测一致）
        energyService = new EnergyService(
                energyMeterMapper, energyConsumptionMapper, locationMapper, locationService, assetMapper);
    }
    @AfterEach
    void tearDown() { TenantContext.clear(); }

    private EnergyMeter meter(Long id, Long assetId, BigDecimal value, LocalDate date) {
        EnergyMeter m = new EnergyMeter(); m.setId(id); m.setAssetId(assetId);
        m.setReadingValue(value); m.setReadingDate(date); m.setUnit("kWh"); return m;
    }

    private EnergyConsumption consumption(Long assetId, String meterType, String period, LocalDate start, BigDecimal value) {
        EnergyConsumption c = new EnergyConsumption(); c.setAssetId(assetId);
        c.setMeterType(meterType); c.setPeriodType(period); c.setPeriodStart(start);
        c.setConsumption(value); c.setUnit("kWh"); return c;
    }

    private Asset asset(Long id) { Asset a = new Asset(); a.setId(id); a.setTenantId("dept:1"); return a; }

    @Nested @DisplayName("读数管理")
    class ReadingTests {
        @Test void addReading_shouldSetDefaultUnit() {
            EnergyMeter m = meter(null, 1L, BigDecimal.valueOf(100), LocalDate.now()); m.setUnit(null);
            energyService.addReading(m); assertEquals("kWh", m.getUnit()); verify(energyMeterMapper).insert(m);
        }
        @Test void addReading_shouldPreserveUnit() {
            EnergyMeter m = meter(null, 1L, BigDecimal.valueOf(100), LocalDate.now()); m.setUnit("m³");
            energyService.addReading(m); assertEquals("m³", m.getUnit()); verify(energyMeterMapper).insert(m);
        }
        @Test void getReadings_emptyTenantAssets_shouldReturnEmpty() {
            when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(Collections.emptyList());
            assertTrue(energyService.getReadings(null, null, null, null).isEmpty());
            verifyNoInteractions(energyMeterMapper);
        }
        @Test void getReadings_assetNotInTenant_shouldReturnEmpty() {
            when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(asset(1L)));
            assertTrue(energyService.getReadings(999L, null, null, null).isEmpty());
            verifyNoInteractions(energyMeterMapper);
        }
        @Test void getReadings_withAllParams_shouldQuery() {
            when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(asset(1L), asset(2L)));
            when(energyMeterMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(meter(1L, 1L, BigDecimal.valueOf(100), LocalDate.now())));
            assertEquals(1, energyService.getReadings(1L, "ELECTRICITY", LocalDate.of(2026,1,1), LocalDate.of(2026,6,1)).size());
        }
    }

    @Nested @DisplayName("能耗汇总")
    class ConsumptionSummaryTests {
        @Test void emptyTenant_shouldReturnEmpty() {
            when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(Collections.emptyList());
            assertTrue(energyService.getConsumptionSummary(null, null, null, null, null).isEmpty());
        }
        @Test void withFilters_shouldQuery() {
            when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(asset(1L)));
            when(energyConsumptionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,1,1),BigDecimal.valueOf(500))));
            assertEquals(1, energyService.getConsumptionSummary(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,1,1),LocalDate.of(2026,6,1)).size());
        }
    }

    @Nested @DisplayName("月度计算")
    class MonthlyCalculationTests {
        @Test void noReadings_shouldReturnNull() {
            when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(asset(1L)));
            when(energyMeterMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(Collections.emptyList());
            assertNull(energyService.calculateMonthlyConsumption(1L,"ELECTRICITY",2026,1));
        }
        @Test void withReadings_shouldCompute() {
            when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(asset(1L)));
            when(energyMeterMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(
                meter(1L,1L,BigDecimal.valueOf(1000),LocalDate.of(2026,1,1)),
                meter(2L,1L,BigDecimal.valueOf(1500),LocalDate.of(2026,1,31))));
            when(energyConsumptionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
            EnergyConsumption result = energyService.calculateMonthlyConsumption(1L,"ELECTRICITY",2026,1);
            assertNotNull(result); assertEquals(BigDecimal.valueOf(500), result.getConsumption());
            verify(energyConsumptionMapper).insert(any(EnergyConsumption.class));
        }
        @Test void existing_shouldUpdate() {
            EnergyConsumption existing = consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,1,1),BigDecimal.valueOf(300));
            when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(asset(1L)));
            when(energyMeterMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(
                meter(1L,1L,BigDecimal.valueOf(1000),LocalDate.of(2026,1,1)),
                meter(2L,1L,BigDecimal.valueOf(2000),LocalDate.of(2026,1,31))));
            when(energyConsumptionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(existing);
            assertEquals(BigDecimal.valueOf(1000), energyService.calculateMonthlyConsumption(1L,"ELECTRICITY",2026,1).getConsumption());
            verify(energyConsumptionMapper).updateById(existing);
            verify(energyConsumptionMapper, never()).insert(any(EnergyConsumption.class));
        }
        @Test void nullPeriodType_shouldDefaultMonth() {
            when(assetMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(asset(1L)));
            when(energyMeterMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(
                meter(1L,1L,BigDecimal.valueOf(100),LocalDate.of(2026,1,1)),
                meter(2L,1L,BigDecimal.valueOf(200),LocalDate.of(2026,1,31))));
            when(energyConsumptionMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
            assertEquals("MONTH", energyService.calculatePeriodConsumption(1L,"ELECTRICITY",null,LocalDate.of(2026,1,1),LocalDate.of(2026,1,31)).getPeriodType());
        }
    }

    @Nested @DisplayName("仪表盘数据")
    class DashboardTests {
        @Test void emptyRecords_shouldReturnEmptyAggregations() {
            when(energyConsumptionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(Collections.emptyList());
            Map<String, Object> result = energyService.getDashboardData(null, null, null, null);
            assertEquals("MONTH", result.get("periodType"));
            assertTrue(((Map<?,?>)result.get("byType")).isEmpty());
            assertEquals(BigDecimal.ZERO, result.get("total"));
        }
        @Test void withLocation_shouldFilterCascade() {
            when(locationService.getCascadeIdsWithRoot(1L)).thenReturn(List.of(1L,2L));
            when(energyConsumptionMapper.selectByLocationIds(anyList(), any(), any(), anyString())).thenReturn(List.of(
                consumption(101L,"ELECTRICITY","MONTH",LocalDate.of(2026,1,1),BigDecimal.valueOf(1000)),
                consumption(102L,"WATER","MONTH",LocalDate.of(2026,2,1),BigDecimal.valueOf(500))));
            Map<String, Object> result = energyService.getDashboardData(LocalDate.of(2026,1,1),LocalDate.of(2026,12,31),"MONTH",1L);
            assertNotNull(result);
            verify(energyConsumptionMapper).selectByLocationIds(anyList(), any(), any(), anyString());
        }
    }

    @Nested @DisplayName("空间聚合")
    class SpaceAggregationTests {
        @Test void nullLocation_shouldReturnEmpty() {
            Map<String,Object> r = energyService.getSummaryByLocation(null, null, null, null);
            assertTrue(((Map<?,?>)r.get("byType")).isEmpty());
            assertEquals(BigDecimal.ZERO, r.get("total"));
        }
        @Test void withLocation_shouldDelegate() {
            when(locationService.getCascadeIdsWithRoot(1L)).thenReturn(List.of(1L));
            when(energyConsumptionMapper.selectByLocationIds(anyList(),any(),any(),anyString())).thenReturn(List.of(consumption(101L,"ELECTRICITY","MONTH",LocalDate.of(2026,1,1),BigDecimal.valueOf(1000))));
            assertFalse(((Map<?,?>)energyService.getSummaryByLocation(1L,LocalDate.of(2026,1,1),LocalDate.of(2026,12,31),"MONTH").get("byType")).isEmpty());
        }
        @Test void nullLocation_returnsEmptyList() {
            assertTrue(energyService.getConsumptionByLocation(null, null, null, null).isEmpty());
        }
        @Test void nullType_shouldReturnEmptyList() {
            assertTrue(energyService.aggregateBySpace(null, null, null, null, null).isEmpty());
        }
        @Test void buildingType_shouldQueryRoots() {
            Location b = new Location(); b.setId(1L); b.setName("建筑A"); b.setLocationType("BUILDING");
            when(locationMapper.findRootLocations()).thenReturn(List.of(b));
            when(locationService.getCascadeIdsWithRoot(1L)).thenReturn(List.of(1L));
            when(energyConsumptionMapper.selectByLocationIds(anyList(),any(),any(),anyString())).thenReturn(List.of(consumption(101L,"ELECTRICITY","MONTH",LocalDate.of(2026,1,1),BigDecimal.valueOf(500))));
            assertEquals(1, energyService.aggregateBySpace(LocationType.BUILDING, null, "MONTH",null,null).size());
        }
    }

    @Nested @DisplayName("同环比对比")
    class CompareTests {
        @Test void shouldComputeChangeRate() {
            when(energyConsumptionMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,1,1),BigDecimal.valueOf(100)),consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,2,1),BigDecimal.valueOf(150))))
                .thenReturn(List.of(consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2025,1,1),BigDecimal.valueOf(80)),consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2025,2,1),BigDecimal.valueOf(120))));
            Map<String,Object> r = energyService.compareRange(LocalDate.of(2026,1,1),LocalDate.of(2026,2,28),LocalDate.of(2025,1,1),LocalDate.of(2025,2,28),"MONTH");
            assertEquals(0, new BigDecimal("25.00").compareTo((BigDecimal)r.get("changeRate")));
        }
        @Test void prevTotalZero_shouldReturnZero() {
            when(energyConsumptionMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,1,1),BigDecimal.valueOf(100))))
                .thenReturn(Collections.emptyList());
            assertEquals(BigDecimal.ZERO, energyService.compareRange(LocalDate.of(2026,1,1),LocalDate.of(2026,1,31),LocalDate.of(2025,1,1),LocalDate.of(2025,1,31),"MONTH").get("changeRate"));
        }
    }

    @Nested @DisplayName("排名")
    class RankingTests {
        @Test void nullScope_shouldReturnEmpty() { assertTrue(energyService.rankingByScope(null,null,null,null).isEmpty()); }
        @Test void asset_shouldCallMapper() {
            when(energyConsumptionMapper.rankingByAsset(any(),any(),any(),any(),any())).thenReturn(List.of(Map.of("assetId",1L,"consumption",BigDecimal.valueOf(1000))));
            assertEquals(1, energyService.rankingByScope("asset","MONTH",null,5).size());
        }
        @Test void invalidLimit_shouldDefaultTo10() {
            when(energyConsumptionMapper.rankingByAsset(any(),any(),any(),any(),eq(10))).thenReturn(List.of());
            energyService.rankingByScope("asset","MONTH",null,-1);
            verify(energyConsumptionMapper).rankingByAsset(any(),any(),any(),any(),eq(10));
        }
    }

    @Nested @DisplayName("异常检测")
    class AnomalyDetectionTests {
        @Test void emptyBuckets_shouldReturnEmpty() {
            when(energyConsumptionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(Collections.emptyList());
            assertTrue(energyService.detectAnomaliesAuthority(LocalDate.of(2026,1,1),LocalDate.of(2026,12,31),"MONTH","zscore",1.5).isEmpty());
        }
        @Test void stddevZero_shouldReturnEmpty() {
            when(energyConsumptionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(
                consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,1,1),BigDecimal.valueOf(500)),
                consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,2,1),BigDecimal.valueOf(500))));
            assertTrue(energyService.detectAnomaliesAuthority(LocalDate.of(2026,1,1),LocalDate.of(2026,12,31),"MONTH","zscore",1.5).isEmpty());
        }
        @Test void withAnomaly_shouldDetect() {
            when(energyConsumptionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(
                consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,1,1),BigDecimal.valueOf(100)),
                consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,2,1),BigDecimal.valueOf(110)),
                consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,3,1),BigDecimal.valueOf(1000))));
            assertFalse(energyService.detectAnomaliesAuthority(LocalDate.of(2026,1,1),LocalDate.of(2026,3,31),"MONTH","zscore",1.0).isEmpty());
        }
    }

    @Nested @DisplayName("空间资产联动")
    class LocationAssetsTests {
        @Test void nullLocation_shouldReturnEmpty() { assertTrue(energyService.getLocationAssetsWithEnergy(null,null,null).isEmpty()); }
        @Test void withLocation_shouldQuery() {
            when(energyConsumptionMapper.assetsByLocation(any(),any(),any(),any(),anyBoolean())).thenReturn(List.of(Map.of("assetId",1L,"consumption",BigDecimal.valueOf(500))));
            assertEquals(1, energyService.getLocationAssetsWithEnergy(1L,"MONTH",true).size());
        }
    }

    @Nested @DisplayName("TenantContext 缺失")
    class TenantContextTests {
        @Test void missing_shouldReturnEmpty() {
            TenantContext.clear();
            assertTrue(energyService.getReadings(null,null,null,null).isEmpty());
            assertTrue(energyService.getConsumptionSummary(null,null,null,null,null).isEmpty());
        }
    }


    @Nested @DisplayName("时间桶工具方法")
    class TimeBucketTests {
        @Test void generateTimeBuckets_monthly_generatesCorrectBuckets() {
            when(energyConsumptionMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(
                    consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,1,15),BigDecimal.valueOf(100)),
                    consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,3,10),BigDecimal.valueOf(200))
                ));
            Map<String, Object> result = energyService.getDashboardData(
                LocalDate.of(2026,1,1), LocalDate.of(2026,3,31), "MONTH", null);
            Map<?, ?> trend = (Map<?, ?>) result.get("trend");
            assertTrue(trend.containsKey("2026-01"));
            assertTrue(trend.containsKey("2026-02"));
            assertTrue(trend.containsKey("2026-03"));
        }

        @Test void formatBucketKey_shouldFormat() {
            when(energyConsumptionMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(
                    consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,1,1),BigDecimal.valueOf(100)),
                    consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,12,1),BigDecimal.valueOf(200))
                ))
                .thenReturn(List.of(
                    consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2025,1,1),BigDecimal.valueOf(80)),
                    consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2025,12,1),BigDecimal.valueOf(160))
                ));
            Map<String, Object> r = energyService.compareRange(
                LocalDate.of(2026,1,1), LocalDate.of(2026,12,31),
                LocalDate.of(2025,1,1), LocalDate.of(2025,12,31), "MONTH");
            Map<?, ?> current = (Map<?, ?>) r.get("current");
            assertTrue(current.containsKey("2026-01"));
            assertTrue(current.containsKey("2026-12"));
        }

        @Test void isInBucket_shouldMatch() {
            when(energyConsumptionMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(
                    consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,1,15),BigDecimal.valueOf(300)),
                    consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,1,31),BigDecimal.valueOf(200))
                ));
            Map<String, Object> result = energyService.getDashboardData(
                LocalDate.of(2026,1,1), LocalDate.of(2026,1,31), "MONTH", null);
            Map<?, ?> trend = (Map<?, ?>) result.get("trend");
            assertEquals(0, BigDecimal.valueOf(500).compareTo((BigDecimal) trend.get("2026-01")));
        }

        @Test void bucketByPeriod_shouldAggregate() {
            when(energyConsumptionMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(
                    consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,1,1),BigDecimal.valueOf(100)),
                    consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2026,1,15),BigDecimal.valueOf(200)),
                    consumption(2L,"WATER","MONTH",LocalDate.of(2026,1,1),BigDecimal.valueOf(50))
                ))
                .thenReturn(List.of(
                    consumption(1L,"ELECTRICITY","MONTH",LocalDate.of(2025,1,1),BigDecimal.valueOf(80))
                ));
            Map<String, Object> r = energyService.compareRange(
                LocalDate.of(2026,1,1), LocalDate.of(2026,1,31),
                LocalDate.of(2025,1,1), LocalDate.of(2025,1,31), "MONTH");
            assertEquals(0, BigDecimal.valueOf(350).compareTo((BigDecimal) r.get("currentTotal")));
            assertEquals(0, BigDecimal.valueOf(80).compareTo((BigDecimal) r.get("previousTotal")));
        }
    }

    @Nested @DisplayName("resolveTenantAssetIds")
    class ResolveTenantAssetIdsTests {
        @Test void resolveTenantAssetIds_shouldReturnTenantAssets() {
            // 验证 TenantContext 设置后 getReadings 不抛出异常（resolveTenantAssetIds 正常执行）
            assertDoesNotThrow(() -> energyService.getReadings(1L, null, null, null));
        }
    }

    @Nested @DisplayName("addReading 边界")
    class AddReadingEdgeTests {
        @Test void addReading_nullReadingValue_shouldHandle() {
            EnergyMeter m = meter(null, 1L, null, LocalDate.now());
            energyService.addReading(m);
            assertNull(m.getReadingValue());
            verify(energyMeterMapper).insert(m);
        }

        @Test void addReading_nullDate_shouldHandle() {
            EnergyMeter m = meter(null, 1L, BigDecimal.valueOf(100), null);
            energyService.addReading(m);
            assertNull(m.getReadingDate());
            verify(energyMeterMapper).insert(m);
        }
    }
}
