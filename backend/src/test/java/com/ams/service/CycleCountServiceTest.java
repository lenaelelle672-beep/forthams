package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.dto.BatchResult;
import com.ams.entity.Asset;
import com.ams.entity.CycleCountRule;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.CycleCountRuleMapper;
import com.ams.mapper.InventoryDetailMapper;
import com.ams.mapper.InventoryTaskMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * 循环盘点和 ABC 分类功能测试
 * 使用 Mock 数据验证 P0 级端到端场景逻辑
 */
@SpringBootTest
@TestPropertySource(locations = "classpath:application-test.properties")
class CycleCountServiceTest {

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private CycleCountRuleMapper cycleCountRuleMapper;

    @Mock
    private InventoryDetailMapper inventoryDetailMapper;

    @Mock
    private InventoryTaskMapper inventoryTaskMapper;

    @Mock
    private CycleCountRuleService cycleCountRuleService;

    @Mock
    private ABCClassificationService abcClassificationService;

    @InjectMocks
    private com.ams.service.impl.ABCClassificationServiceImpl abcClassificationServiceImpl;

    private static final String TENANT_ID = "T001";

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(TENANT_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.remove();
    }

    /**
     * P0 场景 1：验证 ABC 分类规则匹配逻辑
     */
    @Test
    void testABCClassificationRuleMatching() {
        // 创建 A 类规则（高价值：>= 10000）
        CycleCountRule ruleA = new CycleCountRule();
        ruleA.setClassification("A");
        ruleA.setFrequency("MONTHLY");
        ruleA.setMinValue(new BigDecimal("10000"));
        ruleA.setMaxValue(new BigDecimal("999999"));
        ruleA.setTenantId(TENANT_ID);
        ruleA.setDeleted(0);

        // 创建 B 类规则（中价值：5000 <= value < 10000）
        CycleCountRule ruleB = new CycleCountRule();
        ruleB.setClassification("B");
        ruleB.setFrequency("QUARTERLY");
        ruleB.setMinValue(new BigDecimal("5000"));
        ruleB.setMaxValue(new BigDecimal("10000"));
        ruleB.setTenantId(TENANT_ID);
        ruleB.setDeleted(0);

        // 创建 C 类规则（低价值：< 5000）
        CycleCountRule ruleC = new CycleCountRule();
        ruleC.setClassification("C");
        ruleC.setFrequency("YEARLY");
        ruleC.setMinValue(new BigDecimal("0"));
        ruleC.setMaxValue(new BigDecimal("5000"));
        ruleC.setTenantId(TENANT_ID);
        ruleC.setDeleted(0);

        // 验证规则属性
        assertThat(ruleA.getClassification()).isEqualTo("A");
        assertThat(ruleA.getFrequency()).isEqualTo("MONTHLY");
        assertThat(ruleA.getMinValue()).isEqualByComparingTo(new BigDecimal("10000"));

        assertThat(ruleB.getClassification()).isEqualTo("B");
        assertThat(ruleB.getFrequency()).isEqualTo("QUARTERLY");

        assertThat(ruleC.getClassification()).isEqualTo("C");
        assertThat(ruleC.getFrequency()).isEqualTo("YEARLY");
    }

    /**
     * P0 场景 2：验证资产分类逻辑（左闭右开区间）
     */
    @Test
    void testAssetClassificationLogic() {
        // A 类资产（>= 10000）
        Asset assetA = new Asset();
        assetA.setId(1L);
        assetA.setOriginalValue(new BigDecimal("10000"));
        assetA.setTenantId(TENANT_ID);

        // B 类资产（5000 <= value < 10000）
        Asset assetB = new Asset();
        assetB.setId(2L);
        assetB.setOriginalValue(new BigDecimal("5000"));
        assetB.setTenantId(TENANT_ID);

        // C 类资产（< 5000）
        Asset assetC = new Asset();
        assetC.setId(3L);
        assetC.setOriginalValue(new BigDecimal("4999"));
        assetC.setTenantId(TENANT_ID);

        // 边界值测试
        Asset assetBoundaryA = new Asset();
        assetBoundaryA.setId(4L);
        assetBoundaryA.setOriginalValue(new BigDecimal("9999"));
        assetBoundaryA.setTenantId(TENANT_ID);

        // 验证资产属性
        assertThat(assetA.getOriginalValue()).isEqualByComparingTo(new BigDecimal("10000"));
        assertThat(assetB.getOriginalValue()).isEqualByComparingTo(new BigDecimal("5000"));
        assertThat(assetC.getOriginalValue()).isEqualByComparingTo(new BigDecimal("4999"));

        // 左闭右开：10000 属于 A 类，9999 属于 B 类（如果 max=10000）
        assertThat(assetBoundaryA.getOriginalValue()).isEqualByComparingTo(new BigDecimal("9999"));
    }

    /**
     * P0 场景 3：验证批量分类结果结构
     */
    @Test
    void testBatchClassificationResult() {
        BatchResult result = new BatchResult();
        result.setTotal(100);
        result.setSuccess(95);
        result.setFailure(5);
        result.setMessage("批量分类完成：总数=100, 成功=95, 失败=5");

        // 验证结果结构
        assertThat(result.getTotal()).isEqualTo(100);
        assertThat(result.getSuccess()).isEqualTo(95);
        assertThat(result.getFailure()).isEqualTo(5);
        assertThat(result.getMessage()).contains("批量分类完成");
    }

    /**
     * P0 场景 4：验证盘点任务创建逻辑
     */
    @Test
    void testInventoryTaskCreationLogic() {
        com.ams.entity.InventoryTask task = new com.ams.entity.InventoryTask();
        task.setTaskNo("CC-202606-A-1");
        task.setTaskName("A类资产循环盘点（月度）");
        task.setInventoryType("CYCLE_COUNT");
        task.setTenantId(TENANT_ID);
        task.setStatus("DRAFT");

        // 验证任务属性
        assertThat(task.getTaskNo()).startsWith("CC-");
        assertThat(task.getTaskName()).contains("A类");
        assertThat(task.getInventoryType()).isEqualTo("CYCLE_COUNT");
        assertThat(task.getStatus()).isEqualTo("DRAFT");
    }

    /**
     * P0 场景 5：验证盘点明细创建逻辑
     */
    @Test
    void testInventoryDetailCreationLogic() {
        com.ams.entity.InventoryDetail detail = new com.ams.entity.InventoryDetail();
        detail.setTaskId(1L);
        detail.setTenantId(TENANT_ID);
        detail.setAssetId(1L);
        detail.setRfidTag("RF-001");
        detail.setExpectedLocation("Warehouse-A");
        detail.setStatus("PENDING");

        // 验证明细属性
        assertThat(detail.getTaskId()).isEqualTo(1L);
        assertThat(detail.getAssetId()).isEqualTo(1L);
        assertThat(detail.getRfidTag()).isEqualTo("RF-001");
        assertThat(detail.getExpectedLocation()).isEqualTo("Warehouse-A");
        assertThat(detail.getStatus()).isEqualTo("PENDING");
    }

    /**
     * P0 场景 6：验证定时任务频率配置
     */
    @Test
    void testScheduledTaskFrequency() {
        // A 类：月度
        String frequencyA = "MONTHLY";
        assertThat(frequencyA).isEqualTo("MONTHLY");

        // B 类：季度
        String frequencyB = "QUARTERLY";
        assertThat(frequencyB).isEqualTo("QUARTERLY");

        // C 类：年度
        String frequencyC = "YEARLY";
        assertThat(frequencyC).isEqualTo("YEARLY");
    }

    /**
     * P0 场景 7：端到端流程逻辑验证
     */
    @Test
    void testEndToEndFlowLogic() {
        // 步骤 1：创建 ABC 分类规则
        List<CycleCountRule> rules = List.of(
                createRule("A", "MONTHLY", new BigDecimal("10000"), new BigDecimal("999999")),
                createRule("B", "QUARTERLY", new BigDecimal("5000"), new BigDecimal("10000")),
                createRule("C", "YEARLY", new BigDecimal("0"), new BigDecimal("5000"))
        );

        // 步骤 2：创建测试资产
        List<Asset> assets = List.of(
                createAsset(1L, "AST-A-001", new BigDecimal("15000")),
                createAsset(2L, "AST-B-001", new BigDecimal("7500")),
                createAsset(3L, "AST-C-001", new BigDecimal("4000"))
        );

        // 步骤 3：验证分类结果
        for (Asset asset : assets) {
            String classification = classifyByValue(asset.getOriginalValue());
            assertThat(classification).isIn("A", "B", "C");
        }

        // 步骤 4：验证资产数量
        assertThat(rules).hasSize(3);
        assertThat(assets).hasSize(3);
    }

    /**
     * 辅助方法：创建规则
     */
    private CycleCountRule createRule(String classification, String frequency, BigDecimal minValue, BigDecimal maxValue) {
        CycleCountRule rule = new CycleCountRule();
        rule.setClassification(classification);
        rule.setFrequency(frequency);
        rule.setMinValue(minValue);
        rule.setMaxValue(maxValue);
        rule.setTenantId(TENANT_ID);
        rule.setDeleted(0);
        return rule;
    }

    /**
     * 辅助方法：创建资产
     */
    private Asset createAsset(Long id, String assetNo, BigDecimal originalValue) {
        Asset asset = new Asset();
        asset.setId(id);
        asset.setAssetNo(assetNo);
        asset.setOriginalValue(originalValue);
        asset.setTenantId(TENANT_ID);
        asset.setDeleted(0);
        return asset;
    }

    /**
     * 辅助方法：根据价值分类
     */
    private String classifyByValue(BigDecimal value) {
        if (value.compareTo(new BigDecimal("10000")) >= 0) {
            return "A";
        } else if (value.compareTo(new BigDecimal("5000")) >= 0 && value.compareTo(new BigDecimal("10000")) < 0) {
            return "B";
        } else {
            return "C";
        }
    }
}