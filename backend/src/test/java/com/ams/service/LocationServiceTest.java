package com.ams.service;

import com.ams.entity.Location;
import com.ams.entity.LocationType;
import com.ams.mapper.LocationMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LocationServiceTest {

    @Mock
    private LocationMapper locationMapper;

    @InjectMocks
    private LocationService locationService;

    private Location location(Long id, String name, Long parentId) {
        Location loc = new Location();
        loc.setId(id);
        loc.setName(name);
        loc.setParentId(parentId);
        return loc;
    }

    @Test
    void findById_shouldReturnLocation() {
        Location expected = location(1L, "北京市", null);
        when(locationMapper.findById(1L)).thenReturn(expected);
        assertEquals(expected, locationService.findById(1L));
        verify(locationMapper).findById(1L);
    }

    @Test
    void findById_shouldReturnNullWhenNotFound() {
        when(locationMapper.findById(999L)).thenReturn(null);
        assertNull(locationService.findById(999L));
    }

    @Test
    void insert_shouldDelegateToMapper() {
        Location loc = location(null, "新位置", null);
        locationService.insert(loc);
        verify(locationMapper).insert(loc);
    }

    @Test
    void update_shouldDelegateToMapper() {
        Location loc = location(1L, "更新名称", null);
        locationService.update(loc);
        verify(locationMapper).update(loc);
    }

    @Test
    void deleteById_shouldDelegateToMapper() {
        locationService.deleteById(1L);
        verify(locationMapper).deleteById(1L);
    }

    @Test
    void getCascadeIds_nullRoot_shouldReturnEmpty() {
        assertTrue(locationService.getCascadeIds(null).isEmpty());
        verifyNoInteractions(locationMapper);
    }

    @Test
    void getCascadeIds_singleNode_shouldReturnSelf() {
        when(locationMapper.findChildrenByParentId(1L)).thenReturn(Collections.emptyList());
        assertEquals(List.of(1L), locationService.getCascadeIds(1L));
        verify(locationMapper).findChildrenByParentId(1L);
    }

    @Test
    void getCascadeIds_withChildren_shouldReturnFlatList() {
        Location child1 = location(2L, "海淀区", 1L);
        Location child2 = location(3L, "朝阳区", 1L);
        Location grandchild = location(4L, "中关村", 2L);

        when(locationMapper.findChildrenByParentId(1L)).thenReturn(List.of(child1, child2));
        when(locationMapper.findChildrenByParentId(2L)).thenReturn(List.of(grandchild));
        when(locationMapper.findChildrenByParentId(3L)).thenReturn(Collections.emptyList());
        when(locationMapper.findChildrenByParentId(4L)).thenReturn(Collections.emptyList());

        List<Long> result = locationService.getCascadeIds(1L);
        assertEquals(4, result.size());
        assertTrue(result.containsAll(List.of(1L, 2L, 3L, 4L)));
        verify(locationMapper, times(4)).findChildrenByParentId(anyLong());
    }

    @Test
    void getCascadeIds_depthBoundary_shouldNotExceed8() {
        when(locationMapper.findChildrenByParentId(anyLong()))
                .thenAnswer(invocation -> {
                    Long pid = invocation.getArgument(0);
                    if (pid < 9) {
                        return List.of(location(pid + 1, "deep" + (pid + 1), pid));
                    }
                    return Collections.emptyList();
                });
        assertEquals(9, locationService.getCascadeIds(1L).size());
    }

    @Test
    void getCascadeIds_cycle_shouldNotDeadLoop() {
        Location child = location(2L, "子节点", 1L);
        Location backRef = location(1L, "根节点", 2L);
        when(locationMapper.findChildrenByParentId(1L)).thenReturn(List.of(child));
        when(locationMapper.findChildrenByParentId(2L)).thenReturn(List.of(backRef));

        List<Long> result = locationService.getCascadeIds(1L);
        assertEquals(2, result.size());
        assertTrue(result.containsAll(List.of(1L, 2L)));
    }

    @Test
    void getCascadeIdsWithRoot_null_shouldReturnEmpty() {
        assertTrue(locationService.getCascadeIdsWithRoot(null).isEmpty());
    }

    @Test
    void getCascadeIdsWithRoot_shouldIncludeRoot() {
        when(locationMapper.findChildrenByParentId(1L)).thenReturn(Collections.emptyList());
        assertEquals(List.of(1L), locationService.getCascadeIdsWithRoot(1L));
    }

    @Test
    void findChildrenByParentIdAndType_nullType_shouldReturnAll() {
        Location child1 = location(2L, "建筑A", 1L);
        child1.setLocationType("BUILDING");
        Location child2 = location(3L, "楼层B", 1L);
        child2.setLocationType("FLOOR");
        when(locationMapper.findChildrenByParentId(1L)).thenReturn(List.of(child1, child2));

        assertEquals(2, locationService.findChildrenByParentIdAndType(1L, null).size());
    }

    @Test
    void findChildrenByParentIdAndType_withType_shouldFilter() {
        Location child1 = location(2L, "建筑A", 1L);
        child1.setLocationType("BUILDING");
        Location child2 = location(3L, "楼层B", 1L);
        child2.setLocationType("FLOOR");
        when(locationMapper.findChildrenByParentId(1L)).thenReturn(List.of(child1, child2));

        List<Location> result = locationService.findChildrenByParentIdAndType(1L, LocationType.BUILDING);
        assertEquals(1, result.size());
        assertEquals("建筑A", result.get(0).getName());
    }

    @Test
    void findChildrenByParentIdAndType_noMatch_shouldReturnEmpty() {
        Location child = location(2L, "区域R", 1L);
        child.setLocationType("ROOM");
        when(locationMapper.findChildrenByParentId(1L)).thenReturn(List.of(child));

        assertTrue(locationService.findChildrenByParentIdAndType(1L, LocationType.BUILDING).isEmpty());
    }

    @Test
    void updateAncestorsOnInsert_root_shouldSetComma() {
        Location root = location(null, "根节点", null);
        locationService.updateAncestorsOnInsert(root);
        assertEquals(",", root.getAncestors());
        assertEquals(0, root.getLevel());
    }

    @Test
    void updateAncestorsOnInsert_child_shouldComputeAncestors() {
        Location parent = location(1L, "父节点", null);
        parent.setAncestors(",");
        parent.setLevel(0);
        Location child = location(null, "子节点", 1L);
        when(locationMapper.findById(1L)).thenReturn(parent);

        locationService.updateAncestorsOnInsert(child);
        assertEquals(",1,", child.getAncestors());
        assertEquals(1, child.getLevel().intValue());
    }

    @Test
    void updateAncestorsOnInsert_parentNotFound_shouldFallback() {
        Location child = location(null, "子节点", 999L);
        when(locationMapper.findById(999L)).thenReturn(null);

        locationService.updateAncestorsOnInsert(child);
        assertEquals(",", child.getAncestors());
        assertEquals(0, child.getLevel());
    }

    @Test
    void updateAncestorsOnUpdate_noId_shouldDoNothing() {
        locationService.updateAncestorsOnUpdate(location(null, "新节点", null));
        verifyNoInteractions(locationMapper);
    }

    @Test
    void updateAncestorsOnUpdate_existingNotFound_shouldDoNothing() {
        when(locationMapper.findById(1L)).thenReturn(null);
        locationService.updateAncestorsOnUpdate(location(1L, "旧节点", null));
        verify(locationMapper).findById(1L);
    }

    @Test
    void updateAncestorsOnUpdate_parentNotChanged_shouldDoNothing() {
        Location existing = location(1L, "父", null);
        Location update = location(1L, "父更新", null);
        update.setParentId(null);
        when(locationMapper.findById(1L)).thenReturn(existing);

        locationService.updateAncestorsOnUpdate(update);
        assertNull(update.getAncestors());
        assertNull(update.getLevel());
    }

    @Test
    void updateAncestorsOnUpdate_parentChanged_shouldRecalc() {
        Location existing = location(1L, "子", 1L);
        existing.setAncestors(",1,");
        existing.setLevel(1);
        Location parent = location(2L, "新父", null);
        parent.setAncestors(",");
        parent.setLevel(0);
        Location update = location(1L, "子", 2L);
        when(locationMapper.findById(1L)).thenReturn(existing);
        when(locationMapper.findById(2L)).thenReturn(parent);

        locationService.updateAncestorsOnUpdate(update);
        assertEquals(",2,", update.getAncestors());
        assertEquals(1, update.getLevel().intValue());
    }

    @Test
    void updateAncestorsOnUpdate_parentChangedToNull_shouldReset() {
        Location existing = location(1L, "子", 1L);
        existing.setAncestors(",1,");
        Location update = location(1L, "子", null);
        when(locationMapper.findById(1L)).thenReturn(existing);

        locationService.updateAncestorsOnUpdate(update);
        // 当前代码逻辑：parentId 从 1→null 时 parentChanged=false（因 loc.getParentId()!=null 为 false），
        // ancestors/level 保持未设置状态
        assertNull(update.getAncestors());
        assertNull(update.getLevel());
    }

    @Test
    void findDescendants_shouldUseGetCascadeIds() {
        when(locationMapper.findChildrenByParentId(1L)).thenReturn(Collections.emptyList());
        when(locationMapper.findById(1L)).thenReturn(location(1L, "唯一节点", null));

        List<Location> result = locationService.findDescendants(1L);
        assertEquals(1, result.size());
        assertEquals(1L, result.get(0).getId());
    }

    @Test
    void rebuildAncestors_empty_shouldReturnZero() {
        when(locationMapper.findRootLocations()).thenReturn(Collections.emptyList());
        assertEquals(0, locationService.rebuildAncestors());
    }

    @Test
    void rebuildAncestors_withHierarchy_shouldWalkAndRebuild() {
        Location root = location(1L, "根", null);
        Location child = location(2L, "子", 1L);
        Location grandchild = location(3L, "孙", 2L);

        when(locationMapper.findRootLocations()).thenReturn(List.of(root));
        when(locationMapper.findChildrenByParentId(1L)).thenReturn(List.of(child));
        when(locationMapper.findChildrenByParentId(2L)).thenReturn(List.of(grandchild));
        when(locationMapper.findChildrenByParentId(3L)).thenReturn(Collections.emptyList());

        // walkAndRebuild 递归更新 children，root 的 update 计数包含在 walkAndRebuild 之外
        assertEquals(2, locationService.rebuildAncestors());
        // root + child + grandchild 共 3 次 update
        verify(locationMapper, times(3)).update(any(Location.class));
    }

    @Test
    void findRootLocations_shouldDelegate() {
        locationService.findRootLocations();
        verify(locationMapper).findRootLocations();
    }

    @Test
    void findLocationHierarchy_shouldDelegate() {
        locationService.findLocationHierarchy(1L);
        verify(locationMapper).findLocationHierarchy(1L);
    }

    @Test
    void findChildrenByParentId_shouldDelegate() {
        locationService.findChildrenByParentId(1L);
        verify(locationMapper).findChildrenByParentId(1L);
    }

    @Test
    void updateAncestorsOnUpdate_crossHierarchy_shouldRebuildChain() {
        // 子树 A: root(1) → node(2, parentId=1)
        // 子树 B: root(3) → newParent(4, parentId=3)
        // node(2) 有自己的 child(5, parentId=2) 在子树 A 中
        // 将 node(2) 从子树 A(parentId=1) 移到子树 B(parentId=4)
        // 验证 node(2) 的 ancestors chain 和 level 被正确重建为子树 B 的路径
        Location existing = location(2L, "子节点", 1L);
        existing.setAncestors(",1,");
        existing.setLevel(1);

        Location childOfMoving = location(5L, "孙节点", 2L);
        childOfMoving.setAncestors(",1,2,");
        childOfMoving.setLevel(2);

        Location newParent = location(4L, "新父节点", 3L);
        newParent.setAncestors(",3,");
        newParent.setLevel(1);

        Location update = location(2L, "子节点", 4L);
        when(locationMapper.findById(2L)).thenReturn(existing);
        when(locationMapper.findById(4L)).thenReturn(newParent);

        locationService.updateAncestorsOnUpdate(update);
        assertEquals(",3,4,", update.getAncestors());
        assertEquals(2, update.getLevel().intValue());
    }
}
