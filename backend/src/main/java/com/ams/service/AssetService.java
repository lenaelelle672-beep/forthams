package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.AssetCreateDTO;
import com.ams.dto.AssetQueryDTO;
import com.ams.dto.AssetUpdateDTO;
import com.ams.entity.Asset;
import com.ams.enums.AssetStatus;
import com.ams.mapper.AssetMapper;
import com.ams.security.TenantSecurityAudit;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

import com.ams.annotation.DataScope;
import org.springframework.security.access.AccessDeniedException;
@Service
@RequiredArgsConstructor
public class AssetService {

    private static final Logger log = LoggerFactory.getLogger(AssetService.class);

    private final AssetMapper assetMapper;
    private final AssetLifecycleService assetLifecycleService;
    private final AssetParentChildService assetParentChildService;
    private final ABCClassificationService abcClassificationService;

    @DataScope(deptColumn = "dept_id", userColumn = "create_by")
    public Page<Asset> queryAssets(AssetQueryDTO queryDTO) {
        String tenantId = TenantContext.requireTenantId();
        Page<Asset> page = new Page<>(queryDTO.getPage(), queryDTO.getPageSize());

        LambdaQueryWrapper<Asset> wrapper = new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId);

        if (queryDTO.getKeyword() != null && !queryDTO.getKeyword().isBlank()) {
            wrapper.and(w -> w.like(Asset::getAssetNo, queryDTO.getKeyword())
                    .or()
                    .like(Asset::getAssetName, queryDTO.getKeyword()));
        }
        
        if (queryDTO.getAssetNo() != null && !queryDTO.getAssetNo().isEmpty()) {
            wrapper.like(Asset::getAssetNo, queryDTO.getAssetNo());
        }
        if (queryDTO.getAssetName() != null && !queryDTO.getAssetName().isEmpty()) {
            wrapper.like(Asset::getAssetName, queryDTO.getAssetName());
        }
        if (queryDTO.getCategoryId() != null) {
            wrapper.eq(Asset::getCategoryId, queryDTO.getCategoryId());
        }
        if (queryDTO.getStatus() != null && !queryDTO.getStatus().isEmpty()) {
            // 支持逗号分隔的多状态查询（如 "IDLE,IN_USE"）
            if (queryDTO.getStatus().contains(",")) {
                java.util.List<String> statusValues = java.util.Arrays.stream(queryDTO.getStatus().split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .map(s -> parseStatus(s).name())
                        .toList();
                wrapper.in(Asset::getStatus, statusValues);
            } else {
                wrapper.eq(Asset::getStatus, parseStatus(queryDTO.getStatus()).name());
            }
        }
        if (queryDTO.getDeptId() != null) {
            wrapper.eq(Asset::getDeptId, queryDTO.getDeptId());
        }
        if (queryDTO.getIsImportant() != null) {
            wrapper.eq(Asset::getIsImportant, queryDTO.getIsImportant());
        }
        wrapper.orderByDesc(Asset::getCreateTime);

        return assetMapper.selectPage(page, wrapper);
    }

    public Asset getAssetById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        Asset asset = assetMapper.selectOne(assetById(id, tenantId));
        if (asset == null) {
            assertSameTenantOrMissing(id, tenantId, "getAssetById");
        }
        return asset;
    }

    @Transactional(rollbackFor = Exception.class)
    public Asset createAsset(AssetCreateDTO createDTO) {
        String tenantId = TenantContext.requireTenantId();
        if (createDTO.getAssetNo() != null && !createDTO.getAssetNo().isEmpty()) {
            Asset existingAsset = assetMapper.selectOne(
                new LambdaQueryWrapper<Asset>()
                        .eq(Asset::getTenantId, tenantId)
                        .eq(Asset::getAssetNo, createDTO.getAssetNo())
            );
            if (existingAsset != null) {
                throw new BusinessException("资产编号已存在");
            }
        }

        Asset asset = new Asset();
        BeanUtil.copyProperties(createDTO, asset);
        asset.setTenantId(tenantId);
        asset.setStatus(normalizeStatusOrDefault(asset.getStatus(), AssetStatus.IDLE));
        if (asset.getAssetNo() == null || asset.getAssetNo().isEmpty()) {
            Long tenantAssetCount = assetMapper.selectCount(new LambdaQueryWrapper<Asset>()
                    .eq(Asset::getTenantId, tenantId));
            asset.setAssetNo("AST-" + java.time.LocalDate.now().getYear() + "-" + String.format("%04d", tenantAssetCount.intValue() + 1));
        }
        assetMapper.insert(asset);

        // 自动 ABC 分类（降级策略：分类失败不影响资产保存）
        try {
            abcClassificationService.classifyAsset(asset.getId());
        } catch (Exception e) {
            log.warn("[ABC分类] 资产创建后分类失败，资产保存成功: assetId={}, error={}", asset.getId(), e.getMessage());
        }

        return asset;
    }

    @Transactional(rollbackFor = Exception.class)
    public Asset updateAsset(Long id, AssetUpdateDTO updateDTO) {
        String tenantId = TenantContext.requireTenantId();
        Asset asset = getAssetById(id);
        String requestedStatus = updateDTO.getStatus();
        AssetStatus requestedAssetStatus = null;
        if (requestedStatus != null && !requestedStatus.isBlank()) {
            requestedAssetStatus = parseStatus(requestedStatus);
            if (requestedAssetStatus.isTerminal()) {
                throw new BusinessException("资产终态需通过审批流程变更");
            }
        }

        BeanUtil.copyProperties(updateDTO, asset, "id", "assetNo", "createBy", "createTime", "status");

        assetMapper.update(asset, assetById(id, tenantId));

        // 自动 ABC 分类（降级策略：分类失败不影响资产更新）
        try {
            abcClassificationService.classifyAsset(id);
        } catch (Exception e) {
            log.warn("[ABC分类] 资产更新后分类失败，资产更新成功: assetId={}, error={}", id, e.getMessage());
        }

        if (requestedAssetStatus != null) {
            return assetLifecycleService.transitionLoadedAsset(
                    asset,
                    requestedAssetStatus,
                    AssetLifecycleService.CHANGE_TYPE_STATUS,
                    "资产状态更新",
                    null,
                    null);
        }
        return asset;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteAsset(Long id) {
        String tenantId = TenantContext.requireTenantId();
        int deleted = assetMapper.delete(assetById(id, tenantId));
        if (deleted == 0) {
            assertSameTenantOrMissing(id, tenantId, "deleteAsset");
        }
    }

    /**
     * 级联删除资产：先移除所有父子关系，再删除资产本身。
     *
     * @param assetId 资产 ID
     */
    @Transactional(rollbackFor = Exception.class)
    public void deleteByAssetId(Long assetId) {
        String tenantId = TenantContext.requireTenantId();
        // 先校验租户
        Asset asset = assetMapper.selectOne(assetById(assetId, tenantId));
        if (asset == null) {
            throw new BusinessException("资产不存在");
        }
        // 检查是否有子资产
        List<com.ams.entity.AssetParentChild> children = assetParentChildService.getChildren(assetId);
        if (!children.isEmpty()) {
            throw new BusinessException("该资产下有 " + children.size() + " 个子资产，请先移除子资产关系");
        }
        // 移除父资产关系
        List<com.ams.entity.AssetParentChild> parents = assetParentChildService.getParents(assetId);
        for (com.ams.entity.AssetParentChild relation : parents) {
            assetParentChildService.removeRelation(relation.getId());
        }
        // 删除资产本身
        assetMapper.deleteById(assetId);
        log.info("级联删除资产: id={}, assetNo={}", assetId, asset.getAssetNo());
    }

    /**
     * 构建从指定资产开始的完整树形结构（递归，最多 10 层）。
     * 与 getAssetTree 类似但返回 children 列表，更灵活用于批量构建场景。
     *
     * @param id 根资产 ID
     * @return 子资产列表（含递归 children）
     */
    public List<Asset> buildTree(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return buildChildrenTree(id, tenantId, 0);
    }

    private LambdaQueryWrapper<Asset> assetById(Long id, String tenantId) {
        return new LambdaQueryWrapper<Asset>()
                .eq(Asset::getId, id)
                .eq(Asset::getTenantId, tenantId);
    }

    private void assertSameTenantOrMissing(Long id, String tenantId, String action) {
        Asset existingAsset = assetMapper.selectById(id);
        if (existingAsset == null) {
            throw new BusinessException("资产不存在");
        }
        TenantSecurityAudit.logCrossTenantAttempt(log, action, id, tenantId, existingAsset.getTenantId());
        throw new AccessDeniedException("Asset belongs to another tenant");
    }

    private String normalizeStatusOrDefault(String status, AssetStatus defaultStatus) {
        try {
            return AssetStatus.fromNameOrDefault(status, defaultStatus).name();
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("资产状态无效: " + status);
        }
    }

    private AssetStatus parseStatus(String status) {
        try {
            return AssetStatus.fromName(status);
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("资产状态无效: " + status);
        }
    }

    // ── 父子关系管理 ─────────────────────────────────────────────────────────

    /**
     * 获取指定资产的直接子资产列表。
     *
     * @param id 资产 ID
     * @return 子资产列表
     */
    public List<Asset> getChildren(Long id) {
        String tenantId = TenantContext.requireTenantId();
        List<com.ams.entity.AssetParentChild> relations = assetParentChildService.getChildren(id);
        if (relations.isEmpty()) {
            return java.util.Collections.emptyList();
        }
        List<Long> childIds = relations.stream()
                .map(com.ams.entity.AssetParentChild::getChildAssetId)
                .toList();
        return assetMapper.selectBatchIds(childIds).stream()
                .filter(asset -> tenantId.equals(asset.getTenantId()))
                .toList();
    }

    /**
     * 获取指定资产的完整树形结构（递归，最多 10 层）。
     *
     * @param id 资产 ID
     * @return 资产对象，包含 children 字段（递归）
     */
    public Asset getAssetTree(Long id) {
        String tenantId = TenantContext.requireTenantId();
        Asset root = getAssetById(id);
        if (root == null) {
            return null;
        }
        root.setChildren(buildChildrenTree(id, tenantId, 0));
        return root;
    }

    /**
     * 递归构建子资产树。
     *
     * @param parentId 父资产 ID
     * @param tenantId 租户 ID
     * @param depth 当前深度
     * @return 子资产列表
     */
    private List<Asset> buildChildrenTree(Long parentId, String tenantId, int depth) {
        if (depth >= com.ams.entity.AssetParentChild.MAX_TREE_DEPTH) {
            return java.util.Collections.emptyList();
        }
        List<com.ams.entity.AssetParentChild> relations = assetParentChildService.getChildren(parentId);
        if (relations.isEmpty()) {
            return java.util.Collections.emptyList();
        }
        List<Long> childIds = relations.stream()
                .map(com.ams.entity.AssetParentChild::getChildAssetId)
                .toList();
        List<Asset> children = assetMapper.selectBatchIds(childIds).stream()
                .filter(asset -> tenantId.equals(asset.getTenantId()))
                .toList();
        children.forEach(child -> child.setChildren(buildChildrenTree(child.getId(), tenantId, depth + 1)));
        return children;
    }

    /**
     * 获取指定资产的父资产信息。
     *
     * @param id 资产 ID
     * @return 父资产对象，如果没有父资产则返回 null
     */
    public Asset getParentAsset(Long id) {
        String tenantId = TenantContext.requireTenantId();
        List<com.ams.entity.AssetParentChild> parents = assetParentChildService.getParents(id);
        if (parents.isEmpty()) {
            return null;
        }
        // 返回第一个父资产（当前设计只支持单父资产）
        Long parentId = parents.get(0).getParentAssetId();
        Asset parent = assetMapper.selectById(parentId);
        if (parent == null) {
            return null;
        }
        if (!tenantId.equals(parent.getTenantId())) {
            throw new AccessDeniedException("Parent asset belongs to another tenant");
        }
        return parent;
    }

    /**
     * 设置父资产关系。
     *
     * @param id 当前资产 ID
     * @param parentAssetId 要设为父资产的 ID
     * @param relationType 关系类型（可选，默认 OTHER）
     */
    @Transactional(rollbackFor = Exception.class)
    public void setParentAsset(Long id, Long parentAssetId, String relationType) {
        // 先移除现有父关系
        removeParentAsset(id);
        // 添加新关系
        com.ams.dto.AddRelationDTO dto = new com.ams.dto.AddRelationDTO();
        dto.setParentAssetId(parentAssetId);
        dto.setChildAssetId(id);
        dto.setRelationType(relationType != null ? relationType : "OTHER");
        assetParentChildService.addRelation(dto);
    }

    /**
     * 移除父资产关系。
     *
     * @param id 资产 ID
     */
    @Transactional(rollbackFor = Exception.class)
    public void removeParentAsset(Long id) {
        String tenantId = TenantContext.requireTenantId();
        List<com.ams.entity.AssetParentChild> parents = assetParentChildService.getParents(id);
        for (com.ams.entity.AssetParentChild relation : parents) {
            assetParentChildService.removeRelation(relation.getId());
        }
    }

    /**
     * 循环引用校验：从 childAssetId 向上遍历到根，检查 parentAssetId 是否出现在路径中。
     *
     * @param childAssetId 子资产 ID
     * @param parentAssetId 父资产 ID
     * @throws BusinessException 如果存在循环引用
     */
    public void validateNoCircularReference(Long childAssetId, Long parentAssetId) {
        if (childAssetId == null || parentAssetId == null) {
            return;
        }
        Set<Long> visited = new java.util.HashSet<>();
        Long current = parentAssetId;
        while (current != null) {
            if (visited.contains(current)) {
                break;
            }
            if (current.equals(childAssetId)) {
                throw new BusinessException("检测到循环引用：资产不能是其自身的上级");
            }
            visited.add(current);
            List<com.ams.entity.AssetParentChild> parents = assetParentChildService.getParents(current);
            if (parents.isEmpty()) {
                current = null;
            } else {
                current = parents.get(0).getParentAssetId();
            }
        }
    }

    /**
     * 计算 ABC 分类（按 categoryId 分组）。
     *
     * 算法规则：
     * - 按 categoryId 分组计算
     * - 组内按 currentValue 降序排序
     * - 累计价值占比：
     *   - A 类：累计价值占比 0-80%（约占总数量 20%）
     *   - B 类：累计价值占比 80-95%（约占总数量 30%）
     *   - C 类：累计价值占比 95-100%（约占总数量 50%）
     *
     * @param categoryId 分类 ID，如果为 null 则计算所有分类
     * @return 更新后的资产列表（abcClassification 字段已更新）
     */
    @Transactional(rollbackFor = Exception.class)
    public java.util.List<Asset> calculateABCClassification(Long categoryId) {
        String tenantId = TenantContext.requireTenantId();

        // 构建查询条件
        LambdaQueryWrapper<Asset> wrapper = new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId)
                .isNotNull(Asset::getCurrentValue)
                .gt(Asset::getCurrentValue, 0);

        if (categoryId != null) {
            wrapper.eq(Asset::getCategoryId, categoryId);
        }

        // 查询所有资产
        java.util.List<Asset> assets = assetMapper.selectList(wrapper);

        if (assets.isEmpty()) {
            return assets;
        }

        // 按 categoryId 分组
        java.util.Map<Long, java.util.List<Asset>> groupedAssets = assets.stream()
                .collect(java.util.stream.Collectors.groupingBy(Asset::getCategoryId));

        // 对每个分组进行 ABC 分类
        for (java.util.List<Asset> group : groupedAssets.values()) {
            // 按 currentValue 降序排序
            group.sort((a, b) -> {
                java.math.BigDecimal va = a.getCurrentValue();
                java.math.BigDecimal vb = b.getCurrentValue();
                if (va == null) va = java.math.BigDecimal.ZERO;
                if (vb == null) vb = java.math.BigDecimal.ZERO;
                return vb.compareTo(va);
            });

            // 计算总价值
            java.math.BigDecimal totalValue = group.stream()
                    .map(Asset::getCurrentValue)
                    .filter(v -> v != null)
                    .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

            // 如果总价值为 0，全部设为 C
            if (totalValue.compareTo(java.math.BigDecimal.ZERO) <= 0) {
                group.forEach(a -> a.setAbcClassification("C"));
                continue;
            }

            // 累计价值占比，分配 ABC 分类
            java.math.BigDecimal cumulativeValue = java.math.BigDecimal.ZERO;
            for (Asset asset : group) {
                java.math.BigDecimal currentValue = asset.getCurrentValue();
                if (currentValue == null) currentValue = java.math.BigDecimal.ZERO;

                cumulativeValue = cumulativeValue.add(currentValue);
                double percentage = cumulativeValue.divide(totalValue, 4, java.math.RoundingMode.HALF_UP).doubleValue();

                if (percentage <= 0.80) {
                    asset.setAbcClassification("A");
                } else if (percentage <= 0.95) {
                    asset.setAbcClassification("B");
                } else {
                    asset.setAbcClassification("C");
                }

                // 更新数据库
                assetMapper.updateById(asset);
            }
        }


        log.info("ABC 分类计算完成，共更新 {} 个资产", assets.size());
        return assets;
    }

    /**
     * 根据租户ID获取部门ID列表
     *
     * <p>通过查询当前租户的资产数据，收集所有不同的部门ID。
     * 用于租户过滤场景，因为 User 和 Dept 表都没有 tenant_id 字段。</p>
     *
     * @param tenantId 租户ID
     * @return 部门ID列表
     */
    public List<Long> getDeptIdsByTenant(String tenantId) {
        LambdaQueryWrapper<Asset> wrapper = new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId)
                .isNotNull(Asset::getDeptId)
                .select(Asset::getDeptId);

        List<Asset> assets = assetMapper.selectList(wrapper);

        // 收集唯一的部门ID
        return assets.stream()
                .map(Asset::getDeptId)
                .distinct()
                .toList();
    }

}
