package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.dto.BatchResult;
import com.ams.entity.Asset;
import com.ams.entity.CycleCountRule;
import com.ams.mapper.AssetMapper;
import com.ams.service.impl.ABCClassificationServiceImpl;
import com.ams.service.CycleCountRuleService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * ABC 分类服务单元测试
 */
@ExtendWith(MockitoExtension.class)
class ABCClassificationServiceTest {

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private CycleCountRuleService cycleCountRuleService;

    @InjectMocks
    private ABCClassificationServiceImpl abcClassificationService;

    private Asset testAsset;

    @BeforeEach
    void setUp() {
        testAsset = new Asset();
        testAsset.setId(1L);
        testAsset.setAssetNo("AST-2024-0001");
        testAsset.setAssetName("测试资产");
        testAsset.setCategoryId(1L);
        testAsset.setOriginalValue(new BigDecimal("5000"));
        testAsset.setTenantId("tenant-1");
        testAsset.setDeleted(0);
    }

    @AfterEach
    void tearDown() {
        TenantContext.remove();
    }

    @Test
    void testClassifyAsset_MatchRuleA() {
        // A 类规则：originalValue >= 10000
        testAsset.setOriginalValue(new BigDecimal("10000"));

        CycleCountRule rule = new CycleCountRule();
        rule.setId(1L);
        rule.setClassification("A");
        rule.setFrequency("MONTHLY");
        rule.setMinValue(new BigDecimal("10000"));
        rule.setMaxValue(new BigDecimal("999999"));
        rule.setTenantId("tenant-1");
        rule.setDeleted(0);

        when(assetMapper.selectById(1L)).thenReturn(testAsset);
        when(cycleCountRuleService.listAll()).thenReturn(List.of(rule));

        String classification = abcClassificationService.classifyAsset(1L);

        assertEquals("A", classification);
        verify(assetMapper).updateById(any(Asset.class));
    }

    @Test
    void testClassifyAsset_MatchRuleB() {
        // B 类规则：5000 <= originalValue < 10000
        testAsset.setOriginalValue(new BigDecimal("5000"));

        CycleCountRule rule = new CycleCountRule();
        rule.setId(1L);
        rule.setClassification("B");
        rule.setFrequency("QUARTERLY");
        rule.setMinValue(new BigDecimal("5000"));
        rule.setMaxValue(new BigDecimal("10000"));
        rule.setTenantId("tenant-1");
        rule.setDeleted(0);

        when(assetMapper.selectById(1L)).thenReturn(testAsset);
        when(cycleCountRuleService.listAll()).thenReturn(List.of(rule));

        String classification = abcClassificationService.classifyAsset(1L);

        assertEquals("B", classification);
    }

    @Test
    void testClassifyAsset_BoundaryValue() {
        // 边界值测试：originalValue = 10000（左闭右开，应匹配 A 类）
        testAsset.setOriginalValue(new BigDecimal("10000"));

        CycleCountRule ruleA = new CycleCountRule();
        ruleA.setId(1L);
        ruleA.setClassification("A");
        ruleA.setMinValue(new BigDecimal("10000"));
        ruleA.setMaxValue(new BigDecimal("999999"));
        ruleA.setTenantId("tenant-1");
        ruleA.setDeleted(0);

        when(assetMapper.selectById(1L)).thenReturn(testAsset);
        when(cycleCountRuleService.listAll()).thenReturn(List.of(ruleA));

        String classification = abcClassificationService.classifyAsset(1L);

        assertEquals("A", classification);
    }

    @Test
    void testClassifyAsset_NoMatch() {
        // 未匹配任何规则，返回 CATEGORY
        testAsset.setOriginalValue(new BigDecimal("100"));

        when(assetMapper.selectById(1L)).thenReturn(testAsset);
        when(cycleCountRuleService.listAll()).thenReturn(List.of());

        String classification = abcClassificationService.classifyAsset(1L);

        assertEquals("CATEGORY", classification);
    }

    @Test
    void testClassifyAsset_CategoryIdsMatch() {
        // 分类 ID 匹配测试
        testAsset.setOriginalValue(new BigDecimal("5000"));
        testAsset.setCategoryId(1L);

        CycleCountRule rule = new CycleCountRule();
        rule.setId(1L);
        rule.setClassification("B");
        rule.setMinValue(new BigDecimal("5000"));
        rule.setMaxValue(new BigDecimal("10000"));
        rule.setCategoryIds("[1,2,3]");
        rule.setTenantId("tenant-1");
        rule.setDeleted(0);

        when(assetMapper.selectById(1L)).thenReturn(testAsset);
        when(cycleCountRuleService.listAll()).thenReturn(List.of(rule));

        String classification = abcClassificationService.classifyAsset(1L);

        assertEquals("B", classification);
    }

    @Test
    void testGetStatistics_StatisticsData() {
        // 统计数据测试
        TenantContext.setTenantId("tenant-1");

        Asset assetA = new Asset();
        assetA.setAbcClassification("A");
        assetA.setOriginalValue(new BigDecimal("10000"));
        assetA.setTenantId("tenant-1");

        Asset assetB = new Asset();
        assetB.setAbcClassification("B");
        assetB.setOriginalValue(new BigDecimal("5000"));
        assetB.setTenantId("tenant-1");

        when(assetMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(assetA))
                .thenReturn(List.of(assetB))
                .thenReturn(List.of())
                .thenReturn(List.of());

        var stats = abcClassificationService.getStatistics();

        assertNotNull(stats);
        assertEquals(1, stats.getA_count());
        assertEquals(1, stats.getB_count());
        assertEquals(0, stats.getC_count());
    }

    @Test
    void testReclassifyAll_BatchOperation() {
        // 批量操作测试
        TenantContext.setTenantId("tenant-1");

        when(assetMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(testAsset, testAsset, testAsset));
        when(assetMapper.updateABCBatch(any())).thenReturn(3);

        BatchResult result = abcClassificationService.reclassifyAll();

        assertNotNull(result);
        assertEquals(3, result.getTotal());
    }
}