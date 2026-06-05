package com.ams.service;

import com.ams.entity.Location;
import com.ams.entity.LocationType;
import com.ams.mapper.LocationMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * 位置服务（gai2 W6 增量化扩展 — 复用 Location 树 / ancestors LIKE）。
 *
 * <p>blast_radius（AR-6）：</p>
 * <ul>
 *   <li>保留既有 findById / insert / update / findLocationHierarchy / findRootLocations / findChildrenByParentId / findDescendants 7 个方法</li>
 *   <li>新增 findChildrenByParentIdAndType（按类型过滤子节点，W6 增量化）</li>
 *   <li>新增 updateAncestorsOnInsert / updateAncestorsOnUpdate（ancestors 链自动维护，参考 DeptService 模式）</li>
 *   <li>getCascadeIds / getCascadeIdsWithRoot 提供 cascade id 集合（含/不含自身）</li>
 *   <li>rebuildAncestors 重建整棵 ancestors 链（运维用）</li>
 * </ul>
 */
@Service
public class LocationService {

    @Autowired
    private LocationMapper locationMapper;

    public Location findById(Long id) {
        return locationMapper.findById(id);
    }

    public void insert(Location location) {
        locationMapper.insert(location);
    }

    public void update(Location location) {
        locationMapper.update(location);
    }

    public void deleteById(Long id) {
        locationMapper.deleteById(id);
    }

    public List<Location> findLocationHierarchy(Long id) {
        return locationMapper.findLocationHierarchy(id);
    }

    public List<Location> findRootLocations() {
        return locationMapper.findRootLocations();
    }

    public List<Location> findChildrenByParentId(Long parentId) {
        return locationMapper.findChildrenByParentId(parentId);
    }

    public List<Location> findDescendants(Long id) {
        // 已弃用：CTE 在 TenantLineInnerInterceptor 下会注入 tenant_id 列报错。
        // 调用方请改用 getCascadeIds(id) 取 ID 列表，或 findChildrenByParentId(parentId) 单层查询。
        return getCascadeIds(id).stream()
                .map(this::findById)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    /**
     * S0.5f (refine S15) — 递归获取某 locationId 及其全部 descendants 的扁平 ID 列表。
     * 注意：弃用 {@code findDescendants}（CTE） — MyBatis-Plus TenantLineInnerInterceptor
     * 会向 CTE 内 {@code FROM location l} 子查询注入 {@code AND tenant_id = 0}，但
     * {@code location} 表无 tenant_id 列会爆 SQLSyntaxErrorException。改用程序递归 +
     * 简单 {@code findChildrenByParentId}，最大深度 8（PROVINCE→CITY→DISTRICT→BUILDING
     * →FLOOR→ROOM→SUB_AREA→POI 已足够）。
     */
    public List<Long> getCascadeIds(Long rootId) {
        if (rootId == null) return Collections.emptyList();
        List<Long> all = new ArrayList<>();
        all.add(rootId);
        List<Long> currentLayer = new ArrayList<>();
        currentLayer.add(rootId);
        for (int depth = 0; depth < 8 && !currentLayer.isEmpty(); depth++) {
            List<Long> nextLayer = new ArrayList<>();
            for (Long pid : currentLayer) {
                List<Location> children = locationMapper.findChildrenByParentId(pid);
                if (children == null) continue;
                for (Location c : children) {
                    if (c.getId() != null && !all.contains(c.getId())) {
                        all.add(c.getId());
                        nextLayer.add(c.getId());
                    }
                }
            }
            currentLayer = nextLayer;
        }
        return all;
    }

    /**
     * cascade id 列表（含自身 + descendants）— 用于"选某建筑 = 该建筑 + 其下所有楼层/区域"语义
     */
    public List<Long> getCascadeIdsWithRoot(Long rootId) {
        if (rootId == null) return Collections.emptyList();
        List<Long> ids = new ArrayList<>(getCascadeIds(rootId));
        if (!ids.contains(rootId)) {
            ids.add(0, rootId);
        }
        return ids;
    }

    // ── W6 增量化扩展：按类型过滤 + ancestors 链维护 ─────────────────────────

    /**
     * 按 parentId + locationType 过滤子节点（W6 — W7 端点 /{id}/children?type= 配套）。
     * type=null 时退化为 findChildrenByParentId（向后兼容）。
     */
    public List<Location> findChildrenByParentIdAndType(Long parentId, LocationType type) {
        List<Location> children = locationMapper.findChildrenByParentId(parentId);
        if (children == null || type == null) {
            return children;
        }
        return children.stream()
                .filter(l -> type.name().equalsIgnoreCase(l.getLocationType()))
                .collect(Collectors.toList());
    }

    /**
     * ancestors 链自动维护（insert 时调用 — W6 配套 A1 复用 Location 树）。
     * 根节点：ancestors=",", level=0
     * 子节点：ancestors=parent.ancestors + parent.id + ",", level=parent.level+1
     */
    public void updateAncestorsOnInsert(Location loc) {
        if (loc.getParentId() == null) {
            loc.setAncestors(",");
            loc.setLevel(0);
            return;
        }
        Location parent = findById(loc.getParentId());
        if (parent == null) {
            loc.setAncestors(",");
            loc.setLevel(0);
            return;
        }
        String parentAncestors = parent.getAncestors() == null ? "," : parent.getAncestors();
        loc.setAncestors(parentAncestors + parent.getId() + ",");
        loc.setLevel((parent.getLevel() == null ? 0 : parent.getLevel()) + 1);
    }

    /**
     * ancestors 链维护（update 时调用 — parentId 变更需要重算）。
     */
    public void updateAncestorsOnUpdate(Location loc) {
        if (loc.getId() == null) return;
        Location existing = findById(loc.getId());
        if (existing == null) return;
        boolean parentChanged = loc.getParentId() != null
                && !loc.getParentId().equals(existing.getParentId());
        if (parentChanged) {
            if (loc.getParentId() == null) {
                loc.setAncestors(",");
                loc.setLevel(0);
            } else {
                Location parent = findById(loc.getParentId());
                if (parent != null) {
                    String parentAncestors = parent.getAncestors() == null ? "," : parent.getAncestors();
                    loc.setAncestors(parentAncestors + parent.getId() + ",");
                    loc.setLevel((parent.getLevel() == null ? 0 : parent.getLevel()) + 1);
                }
            }
        }
    }

    /**
     * 重建整棵 ancestors 链（运维用 — 配合 V2_9 migration 数据回填或断链修复）。
     */
    public int rebuildAncestors() {
        List<Location> roots = locationMapper.findRootLocations();
        if (roots == null || roots.isEmpty()) return 0;
        int updated = 0;
        for (Location root : roots) {
            root.setAncestors(",");
            root.setLevel(0);
            locationMapper.update(root);
            updated += walkAndRebuild(root, root.getAncestors(), root.getLevel());
        }
        return updated;
    }

    private int walkAndRebuild(Location parent, String parentAncestors, int parentLevel) {
        List<Location> children = locationMapper.findChildrenByParentId(parent.getId());
        if (children == null) return 0;
        int count = 0;
        for (Location child : children) {
            child.setAncestors(parentAncestors + parent.getId() + ",");
            child.setLevel(parentLevel + 1);
            locationMapper.update(child);
            count++;
            count += walkAndRebuild(child, child.getAncestors(), child.getLevel());
        }
        return count;
    }
}
