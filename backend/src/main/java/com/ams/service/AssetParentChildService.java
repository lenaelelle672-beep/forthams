package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.AddRelationDTO;
import com.ams.entity.Asset;
import com.ams.entity.AssetParentChild;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.AssetParentChildMapper;
import com.ams.security.TenantSecurityAudit;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 资产主附属关系（父子关系）服务。
 *
 * <p>提供父子关系的 CRUD、树形查询、循环引用校验和级联删除能力。
 * 所有查询强制使用 TenantContext.requireTenantId() 实现租户隔离。</p>
 */
@Service
@RequiredArgsConstructor
public class AssetParentChildService {

    private static final Logger log = LoggerFactory.getLogger(AssetParentChildService.class);

    private final AssetParentChildMapper assetParentChildMapper;
    private final AssetMapper assetMapper;
    private final ApplicationContext applicationContext;

    private AssetService getAssetService() {
        return applicationContext.getBean(AssetService.class);
    }

    // ── 查询方法 ─────────────────────────────────────────────────────────────────

    /**
     * 获取指定父资产的所有直接子关联记录。
     *
     * @param parentAssetId 父资产 ID
     * @return 子关联记录列表
     */
    public List<AssetParentChild> getChildren(Long parentAssetId) {
        String tenantId = TenantContext.requireTenantId();
        return assetParentChildMapper.selectList(
                new LambdaQueryWrapper<AssetParentChild>()
                        .eq(AssetParentChild::getParentAssetId, parentAssetId)
                        .eq(AssetParentChild::getTenantId, tenantId)
                        .orderByDesc(AssetParentChild::getCreateTime)
        );
    }

    /**
     * 获取指定子资产的所有父关联记录（即此资产作为子时的关联）。
     *
     * @param childAssetId 子资产 ID
     * @return 父关联记录列表
     */
    public List<AssetParentChild> getParents(Long childAssetId) {
        String tenantId = TenantContext.requireTenantId();
        return assetParentChildMapper.selectList(
                new LambdaQueryWrapper<AssetParentChild>()
                        .eq(AssetParentChild::getChildAssetId, childAssetId)
                        .eq(AssetParentChild::getTenantId, tenantId)
                        .orderByDesc(AssetParentChild::getCreateTime)
        );
    }

    /**
     * 获取关系的 VO 列表（附带资产名称等补充信息）。
     * 返回 Map 列表，每条包含 relation id、parentAssetId、childAssetId、
     * relationType、quantity、remark、childAssetName、childAssetNo。
     */
    public List<Map<String, Object>> getChildrenWithAssetInfo(Long parentAssetId) {
        List<AssetParentChild> relations = getChildren(parentAssetId);
        return buildRelationVOList(relations);
    }

    /**
     * 获取此资产作为子时的父关联 VO 列表。
     */
    public List<Map<String, Object>> getParentsWithAssetInfo(Long childAssetId) {
        List<AssetParentChild> relations = getParents(childAssetId);
        return buildRelationVOList(relations);
    }

    /**
     * 以指定资产 ID 为根节点，构建完整的父子关系树。
     * <p>查询算法：</p>
     * <ol>
     *   <li>从根节点出发，递归加载每层的子关联（getChildren）</li>
     *   <li>组合节点资产信息（assetName, assetNo）</li>
     *   <li>返回嵌套树结构</li>
     * </ol>
     *
     * @param assetId 根资产 ID
     * @return 树形节点列表，每个节点包含资产信息和 children 数组
     */
    public List<Map<String, Object>> getTree(Long assetId) {
        String tenantId = TenantContext.requireTenantId();
        List<Map<String, Object>> tree = new ArrayList<>();
        Set<Long> visited = new HashSet<>();
        visited.add(assetId);

        List<Map<String, Object>> directChildren = getChildrenWithAssetInfo(assetId);
        for (Map<String, Object> child : directChildren) {
            Long childId = ((Number) child.get("childAssetId")).longValue();
            if (!visited.contains(childId)) {
                visited.add(childId);
                Map<String, Object> node = buildTreeNode(child, assetId, visited, 1);
                tree.add(node);
            }
        }
        return tree;
    }

    // ── 写操作 ─────────────────────────────────────────────────────────────────

    /**
     * 添加父子关系。
     * <p>包含以下校验：</p>
     * <ul>
     *   <li>父资产和子资产必须存在且属于同一租户</li>
     *   <li>父资产和子资产不能相同</li>
     *   <li>不能重复建立同一对关系</li>
     *   <li>循环引用校验：从父资产向上遍历到根，检查子资产是否出现在上游路径中</li>
     * </ul>
     *
     * @param dto 关联请求 DTO
     * @return 创建的关系记录
     */
    @Transactional(rollbackFor = Exception.class)
    public AssetParentChild addRelation(AddRelationDTO dto) {
        String tenantId = TenantContext.requireTenantId();

        Long parentAssetId = dto.getParentAssetId();
        Long childAssetId = dto.getChildAssetId();

        // 参数校验
        if (parentAssetId == null || childAssetId == null) {
            throw new BusinessException("父资产ID和子资产ID不能为空");
        }
        if (parentAssetId.equals(childAssetId)) {
            throw new BusinessException("父资产和子资产不能相同");
        }

        // 验证父资产存在且属于同一租户
        Asset parentAsset = assetMapper.selectById(parentAssetId);
        if (parentAsset == null) {
            throw new BusinessException("父资产不存在");
        }
        assertSameTenant(parentAsset.getTenantId(), tenantId, parentAssetId, "addRelation:parent");

        // 验证子资产存在且属于同一租户
        Asset childAsset = assetMapper.selectById(childAssetId);
        if (childAsset == null) {
            throw new BusinessException("子资产不存在");
        }
        assertSameTenant(childAsset.getTenantId(), tenantId, childAssetId, "addRelation:child");

        // 检查是否已存在相同关系
        Long existingCount = assetParentChildMapper.selectCount(
                new LambdaQueryWrapper<AssetParentChild>()
                        .eq(AssetParentChild::getParentAssetId, parentAssetId)
                        .eq(AssetParentChild::getChildAssetId, childAssetId)
                        .eq(AssetParentChild::getTenantId, tenantId)
        );
        if (existingCount > 0) {
            throw new BusinessException("已存在相同的父子关系");
        }

        // 循环引用校验：复用 AssetService.validateNoCircularReference
        getAssetService().validateNoCircularReference(childAssetId, parentAssetId);

        // 创建关系记录
        AssetParentChild relation = new AssetParentChild();
        relation.setParentAssetId(parentAssetId);
        relation.setChildAssetId(childAssetId);
        relation.setRelationType(dto.getRelationType() != null ? dto.getRelationType() : "OTHER");
        relation.setQuantity(dto.getQuantity() != null ? dto.getQuantity() : 1);
        relation.setRemark(dto.getRemark());
        relation.setTenantId(tenantId);
        relation.setCreateTime(LocalDateTime.now());

        assetParentChildMapper.insert(relation);
        log.info("资产父子关系已创建: parentAssetId={}, childAssetId={}, relationType={}",
                parentAssetId, childAssetId, dto.getRelationType());
        return relation;
    }

    /**
     * 删除指定关系记录。
     *
     * @param id 关系 ID
     */
    @Transactional(rollbackFor = Exception.class)
    public void removeRelation(Long id) {
        String tenantId = TenantContext.requireTenantId();
        AssetParentChild relation = assetParentChildMapper.selectById(id);
        if (relation == null) {
            log.warn("资产父子关系不存在，忽略删除: relationId={}", id);
            return;
        }
        // 租户隔离校验
        if (!tenantId.equals(relation.getTenantId())) {
            TenantSecurityAudit.logCrossTenantAttempt(log, "removeRelation", id, tenantId, relation.getTenantId());
            throw new AccessDeniedException("Relation belongs to another tenant");
        }
        assetParentChildMapper.deleteById(id);
        log.info("资产父子关系已删除: relationId={}, parentAssetId={}, childAssetId={}",
                id, relation.getParentAssetId(), relation.getChildAssetId());
    }

    /**
     * 更新父子关系。
     * <p>仅支持更新关系类型、数量和备注，不支持修改父资产和子资产。</p>
     * <p>包含以下校验：</p>
     * <ul>
     *   <li>关系记录必须存在且属于当前租户</li>
     *   <li>路径上的资产 ID 必须与关系中的父资产 ID 一致</li>
     * </ul>
     *
     * @param id 关系 ID
     * @param assetId 路径上的资产 ID（应与关系中的父资产 ID 一致）
     * @param dto 更新请求 DTO
     * @return 更新后的关系记录
     */
    @Transactional(rollbackFor = Exception.class)
    public AssetParentChild updateRelation(Long id, Long assetId, AddRelationDTO dto) {
        String tenantId = TenantContext.requireTenantId();

        // 查询关系记录
        AssetParentChild relation = assetParentChildMapper.selectById(id);
        if (relation == null) {
            throw new BusinessException("资产父子关系不存在");
        }

        // 租户隔离校验
        if (!tenantId.equals(relation.getTenantId())) {
            TenantSecurityAudit.logCrossTenantAttempt(log, "updateRelation", id, tenantId, relation.getTenantId());
            throw new AccessDeniedException("Relation belongs to another tenant");
        }

        // 验证路径上的资产 ID 与关系中的父资产 ID 一致
        if (!relation.getParentAssetId().equals(assetId)) {
            throw new BusinessException("路径上的资产ID与关系中的父资产ID不一致");
        }

        // 仅更新可修改字段
        if (dto.getRelationType() != null) {
            relation.setRelationType(dto.getRelationType());
        }
        if (dto.getQuantity() != null) {
            relation.setQuantity(dto.getQuantity());
        }
        if (dto.getRemark() != null) {
            relation.setRemark(dto.getRemark());
        }

        assetParentChildMapper.updateById(relation);
        log.info("资产父子关系已更新: relationId={}, parentAssetId={}, childAssetId={}, relationType={}",
                id, relation.getParentAssetId(), relation.getChildAssetId(), relation.getRelationType());
        return relation;
    }

    /**
     * 删除指定资产相关的所有父子关系记录（作为父资产或子资产）。
     * <p>供 AssetService.deleteAsset() 级联调用。</p>
     *
     * @param assetId 资产 ID
     */
    @Transactional(rollbackFor = Exception.class)
    public void deleteByAssetId(Long assetId) {
        if (assetId == null) {
            throw new IllegalArgumentException("资产ID不能为空");
        }

        String tenantId = TenantContext.requireTenantId();
        int deleted = assetParentChildMapper.delete(
                new LambdaQueryWrapper<AssetParentChild>()
                        .eq(AssetParentChild::getTenantId, tenantId)
                        .and(wrapper -> wrapper.eq(AssetParentChild::getParentAssetId, assetId)
                                .or()
                                .eq(AssetParentChild::getChildAssetId, assetId))
        );
        log.info("资产父子关系已批量清理: assetId={}, count={}", assetId, deleted);
    }

    // ── 树形查询辅助方法 ─────────────────────────────────────────────────────

    /**
     * 递归构建树节点。
     */
    private Map<String, Object> buildTreeNode(Map<String, Object> relationVO, Long parentAssetId,
                                                Set<Long> visited, int depth) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("relationId", relationVO.get("relationId"));
        node.put("childAssetId", relationVO.get("childAssetId"));
        node.put("childAssetName", relationVO.get("childAssetName"));
        node.put("childAssetNo", relationVO.get("childAssetNo"));
        node.put("relationType", relationVO.get("relationType"));
        node.put("quantity", relationVO.get("quantity"));
        node.put("remark", relationVO.get("remark"));

        Long childId = ((Number) relationVO.get("childAssetId")).longValue();

        // 递归加载子节点的关联
        if (depth < AssetParentChild.MAX_TREE_DEPTH) {
            List<Map<String, Object>> grandChildren = getChildrenWithAssetInfo(childId);
            List<Map<String, Object>> childrenNodes = new ArrayList<>();
            for (Map<String, Object> gc : grandChildren) {
                Long gcChildId = ((Number) gc.get("childAssetId")).longValue();
                if (!visited.contains(gcChildId)) {
                    visited.add(gcChildId);
                    childrenNodes.add(buildTreeNode(gc, childId, visited, depth + 1));
                }
            }
            node.put("children", childrenNodes);
        } else {
            node.put("children", Collections.emptyList());
        }
        return node;
    }

    /**
     * 将 AssetParentChild 列表转换为 VO 列表（附带资产名称等）。
     */
    private List<Map<String, Object>> buildRelationVOList(List<AssetParentChild> relations) {
        return relations.stream().map(r -> {
            Map<String, Object> vo = new LinkedHashMap<>();
            vo.put("relationId", r.getId());
            vo.put("parentAssetId", r.getParentAssetId());
            vo.put("childAssetId", r.getChildAssetId());
            vo.put("relationType", r.getRelationType());
            vo.put("quantity", r.getQuantity());
            vo.put("remark", r.getRemark());
            vo.put("createTime", r.getCreateTime());

            // 查询子资产名称和编号
            Asset childAsset = assetMapper.selectById(r.getChildAssetId());
            if (childAsset != null) {
                vo.put("childAssetName", childAsset.getAssetName());
                vo.put("childAssetNo", childAsset.getAssetNo());
            }

            // 查询父资产名称和编号
            Asset parentAsset = assetMapper.selectById(r.getParentAssetId());
            if (parentAsset != null) {
                vo.put("parentAssetName", parentAsset.getAssetName());
                vo.put("parentAssetNo", parentAsset.getAssetNo());
            }
            return vo;
        }).collect(Collectors.toList());
    }

    /**
     * 验证资源所属租户与当前请求租户一致，否则记录审计日志并抛出异常。
     */
    private void assertSameTenant(String resourceTenantId, String requestTenantId,
                                  Long resourceId, String action) {
        if (!requestTenantId.equals(resourceTenantId)) {
            TenantSecurityAudit.logCrossTenantAttempt(log, action, resourceId, requestTenantId, resourceTenantId);
            throw new AccessDeniedException("Asset belongs to another tenant");
        }
    }
}
