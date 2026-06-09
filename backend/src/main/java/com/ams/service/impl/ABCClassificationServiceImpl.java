package com.ams.service.impl;

import com.ams.context.TenantContext;
import com.ams.dto.BatchResult;
import com.ams.entity.Asset;
import com.ams.entity.CycleCountRule;
import com.ams.mapper.AssetMapper;
import com.ams.service.ABCClassificationService;
import com.ams.service.CycleCountRuleService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * ABC 分类服务实现
 * 分类逻辑：左闭右开区间（originalValue >= minValue && originalValue < maxValue）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ABCClassificationServiceImpl implements ABCClassificationService {

    private final AssetMapper assetMapper;
    private final CycleCountRuleService cycleCountRuleService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public String classifyAsset(Long assetId) {
        // 查询资产
        Asset asset = assetMapper.selectById(assetId);
        if (asset == null) {
            log.warn("[ABC分类] 资产不存在: assetId={}", assetId);
            return null;
        }

        String tenantId = TenantContext.getTenantId();
        if (tenantId == null) {
            tenantId = asset.getTenantId();
        }

        // 查询所有启用的分类规则
        List<CycleCountRule> rules = cycleCountRuleService.listAll();
        if (rules.isEmpty()) {
            log.warn("[ABC分类] 未找到分类规则");
            return "CATEGORY";
        }

        // 遍历规则进行匹配
        for (CycleCountRule rule : rules) {
            if (!tenantId.equals(rule.getTenantId()) || rule.getDeleted() == 1) {
                continue;
            }

            // 匹配价值区间（左闭右开）
            BigDecimal originalValue = asset.getOriginalValue();
            if (originalValue == null) {
                continue;
            }

            boolean matchValue = true;
            if (rule.getMinValue() != null && originalValue.compareTo(rule.getMinValue()) < 0) {
                matchValue = false;
            }
            if (rule.getMaxValue() != null && originalValue.compareTo(rule.getMaxValue()) >= 0) {
                matchValue = false;
            }

            if (!matchValue) {
                continue;
            }

            // 匹配分类 ID
            if (rule.getCategoryIds() != null && !rule.getCategoryIds().trim().isEmpty()) {
                try {
                    List<Long> categoryIds = objectMapper.readValue(rule.getCategoryIds(), new TypeReference<List<Long>>() {});
                    if (!categoryIds.isEmpty() && !categoryIds.contains(asset.getCategoryId())) {
                        continue;
                    }
                } catch (JsonProcessingException e) {
                    log.warn("[ABC分类] 解析 categoryIds JSON 失败: ruleId={}", rule.getId(), e);
                    continue;
                }
            }

            // 匹配成功，更新分类
            String classification = rule.getClassification();
            asset.setAbcClassification(classification);
            assetMapper.updateById(asset);
            log.info("[ABC分类] 资产分类成功: assetId={}, classification={}", assetId, classification);
            return classification;
        }

        // 未匹配任何规则，返回 CATEGORY
        asset.setAbcClassification("CATEGORY");
        assetMapper.updateById(asset);
        log.info("[ABC分类] 资产未匹配任何规则，设为 CATEGORY: assetId={}", assetId);
        return "CATEGORY";
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public BatchResult reclassifyAll() {
        String tenantId = TenantContext.requireTenantId();
        BatchResult result = new BatchResult();

        // 查询所有资产
        List<Asset> assets = assetMapper.selectList(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId)
                .eq(Asset::getDeleted, 0));

        if (assets.isEmpty()) {
            result.setTotal(0);
            result.setSuccess(0);
            result.setFailure(0);
            result.setMessage("无资产需要分类");
            return result;
        }

        result.setTotal(assets.size());
        int successCount = 0;
        int failureCount = 0;

        // 批量更新，每批 500 条
        List<Asset> batch = new ArrayList<>(500);
        for (Asset asset : assets) {
            try {
                // 查询规则匹配
                String classification = findClassification(asset);
                asset.setAbcClassification(classification);
                batch.add(asset);

                if (batch.size() >= 500) {
                    assetMapper.updateABCBatch(batch);
                    successCount += batch.size();
                    log.info("[ABC分类] 批量更新分类: batch size={}, total success={}", batch.size(), successCount);
                    batch.clear();
                }
            } catch (RuntimeException e) {
                    failureCount++;
                log.warn("[ABC分类] 资产分类失败: assetId={}", asset.getId(), e);
            }
        }

        // 处理剩余批次
        if (!batch.isEmpty()) {
            try {
                assetMapper.updateABCBatch(batch);
                successCount += batch.size();
            } catch (RuntimeException e) {
                failureCount += batch.size();
                log.error("[ABC分类] 批量更新失败: batch size={}, error={}", batch.size(), e.getMessage(), e);
            }
        }

        result.setSuccess(successCount);
        result.setFailure(failureCount);
        result.setMessage(String.format("批量重新分类完成：总数=%d, 成功=%d, 失败=%d",
                assets.size(), successCount, failureCount));

        log.info("[ABC分类] 批量重新分类完成: {}", result.getMessage());
        return result;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public BatchResult reclassifyByCategoryIds(List<Long> categoryIds) {
        String tenantId = TenantContext.requireTenantId();
        BatchResult result = new BatchResult();

        // 查询指定分类的资产
        List<Asset> assets = assetMapper.selectList(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId)
                .in(Asset::getCategoryId, categoryIds)
                .eq(Asset::getDeleted, 0));

        if (assets.isEmpty()) {
            result.setTotal(0);
            result.setSuccess(0);
            result.setFailure(0);
            result.setMessage("无资产需要分类");
            return result;
        }

        result.setTotal(assets.size());
        int successCount = 0;
        int failureCount = 0;

        // 批量更新
        List<Asset> batch = new ArrayList<>(500);
        for (Asset asset : assets) {
            try {
                String classification = findClassification(asset);
                asset.setAbcClassification(classification);
                batch.add(asset);

                if (batch.size() >= 500) {
                    assetMapper.updateABCBatch(batch);
                    successCount += batch.size();
                    batch.clear();
                }
            } catch (RuntimeException e) {
                failureCount++;
                log.warn("[ABC分类] 资产分类失败: assetId={}", asset.getId(), e);
            }
        }

        if (!batch.isEmpty()) {
            try {
                assetMapper.updateABCBatch(batch);
                successCount += batch.size();
            } catch (RuntimeException e) {
                failureCount += batch.size();
                log.error("[ABC分类] 批量更新失败: batch size={}, error={}", batch.size(), e.getMessage(), e);
            }
        }

        result.setSuccess(successCount);
        result.setFailure(failureCount);
        result.setMessage(String.format("批量重新分类完成：总数=%d, 成功=%d, 失败=%d",
                assets.size(), successCount, failureCount));

        log.info("[ABC分类] 批量重新分类完成（按分类 ID）: {}", result.getMessage());
        return result;
    }

    @Override
    public ClassificationStatistics getStatistics() {
        String tenantId = TenantContext.requireTenantId();
        ClassificationStatistics stats = new ClassificationStatistics();

        // 查询 A 类资产
        List<Asset> assetsA = assetMapper.selectList(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId)
                .eq(Asset::getAbcClassification, "A")
                .eq(Asset::getDeleted, 0));
        stats.setA_count(assetsA.size());
        stats.setA_total_value(assetsA.stream()
                .map(Asset::getOriginalValue)
                .filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add));

        // 查询 B 类资产
        List<Asset> assetsB = assetMapper.selectList(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId)
                .eq(Asset::getAbcClassification, "B")
                .eq(Asset::getDeleted, 0));
        stats.setB_count(assetsB.size());
        stats.setB_total_value(assetsB.stream()
                .map(Asset::getOriginalValue)
                .filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add));

        // 查询 C 类资产
        List<Asset> assetsC = assetMapper.selectList(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId)
                .eq(Asset::getAbcClassification, "C")
                .eq(Asset::getDeleted, 0));
        stats.setC_count(assetsC.size());
        stats.setC_total_value(assetsC.stream()
                .map(Asset::getOriginalValue)
                .filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add));

        // 查询 CATEGORY 类资产
        List<Asset> assetsCategory = assetMapper.selectList(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId)
                .eq(Asset::getAbcClassification, "CATEGORY")
                .eq(Asset::getDeleted, 0));
        stats.setCATEGORY_count(assetsCategory.size());
        stats.setCATEGORY_total_value(assetsCategory.stream()
                .map(Asset::getOriginalValue)
                .filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add));

        log.info("[ABC分类] 统计数据: A={}, B={}, C={}, CATEGORY={}",
                stats.getA_count(), stats.getB_count(), stats.getC_count(), stats.getCATEGORY_count());

        return stats;
    }

    @Override
    public String getByAssetId(Long assetId) {
        Asset asset = assetMapper.selectById(assetId);
        if (asset == null) {
            return null;
        }

        // 租户校验
        String tenantId = TenantContext.requireTenantId();
        if (!tenantId.equals(asset.getTenantId())) {
            throw new RuntimeException("无权限访问该资产");
        }

        return asset.getAbcClassification();
    }

    /**
     * 根据资产查找分类
     */
    private String findClassification(Asset asset) {
        String tenantId = asset.getTenantId();
        List<CycleCountRule> rules = cycleCountRuleService.listAll();

        for (CycleCountRule rule : rules) {
            if (!tenantId.equals(rule.getTenantId()) || rule.getDeleted() == 1) {
                continue;
            }

            // 匹配价值区间（左闭右开）
            BigDecimal originalValue = asset.getOriginalValue();
            if (originalValue == null) {
                continue;
            }

            boolean matchValue = true;
            if (rule.getMinValue() != null && originalValue.compareTo(rule.getMinValue()) < 0) {
                matchValue = false;
            }
            if (rule.getMaxValue() != null && originalValue.compareTo(rule.getMaxValue()) >= 0) {
                matchValue = false;
            }

            if (!matchValue) {
                continue;
            }

            // 匹配分类 ID
            if (rule.getCategoryIds() != null && !rule.getCategoryIds().trim().isEmpty()) {
                try {
                    List<Long> categoryIds = objectMapper.readValue(rule.getCategoryIds(), new TypeReference<List<Long>>() {});
                    if (!categoryIds.isEmpty() && !categoryIds.contains(asset.getCategoryId())) {
                        continue;
                    }
                } catch (JsonProcessingException e) {
                    log.warn("[ABC分类] 解析 categoryIds JSON 失败: ruleId={}", rule.getId(), e);
                    continue;
                }
            }

            // 匹配成功
            return rule.getClassification();
        }

        return "CATEGORY";
    }
}
