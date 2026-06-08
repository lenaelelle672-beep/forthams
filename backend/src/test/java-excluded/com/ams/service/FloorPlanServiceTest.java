package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.FloorPlan;
import com.ams.entity.FloorPlanAsset;
import com.ams.mapper.FloorPlanAssetMapper;
import com.ams.mapper.FloorPlanMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
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

@ExtendWith(MockitoExtension.class)
class FloorPlanServiceTest {

    @Mock
    private FloorPlanMapper floorPlanMapper;

    @Mock
    private FloorPlanAssetMapper floorPlanAssetMapper;

    @InjectMocks
    private FloorPlanService floorPlanService;

    private FloorPlan plan(Long id, String name) {
        FloorPlan p = new FloorPlan();
        p.setId(id);
        p.setName(name);
        return p;
    }

    private FloorPlanAsset asset(Long id, Long planId, Long assetId) {
        FloorPlanAsset a = new FloorPlanAsset();
        a.setId(id);
        a.setPlanId(planId);
        a.setAssetId(assetId);
        return a;
    }

    @Test
    void listPage_withKeyword_shouldSearchByName() {
        Page<FloorPlan> mockPage = new Page<>(1, 10);
        mockPage.setRecords(List.of(plan(1L, "平面图A")));
        mockPage.setTotal(1);
        when(floorPlanMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class))).thenReturn(mockPage);

        Page<FloorPlan> result = floorPlanService.listPage(1, 10, "A");
        assertEquals(1, result.getTotal());
        assertEquals("平面图A", result.getRecords().get(0).getName());
    }

    @Test
    void listPage_withoutKeyword_shouldReturnAll() {
        Page<FloorPlan> mockPage = new Page<>(1, 10);
        when(floorPlanMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class))).thenReturn(mockPage);
        assertNotNull(floorPlanService.listPage(1, 10, null));
    }

    @Test
    void listPage_blankKeyword_shouldIgnore() {
        Page<FloorPlan> mockPage = new Page<>(1, 10);
        when(floorPlanMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class))).thenReturn(mockPage);
        assertNotNull(floorPlanService.listPage(1, 10, "   "));
    }

    @Test
    void getById_existing_shouldReturn() {
        FloorPlan expected = plan(1L, "平面图X");
        when(floorPlanMapper.selectById(1L)).thenReturn(expected);
        assertEquals(expected, floorPlanService.getById(1L));
    }

    @Test
    void getById_notFound_shouldThrow() {
        when(floorPlanMapper.selectById(999L)).thenReturn(null);
        BusinessException ex = assertThrows(BusinessException.class, () -> floorPlanService.getById(999L));
        assertEquals("平面图不存在", ex.getMessage());
    }

    @Test
    void create_shouldInsert() {
        FloorPlan newPlan = plan(null, "新平面图");
        FloorPlan result = floorPlanService.create(newPlan);
        assertEquals("新平面图", result.getName());
        verify(floorPlanMapper).insert(newPlan);
    }

    @Test
    void update_existing_shouldUpdateAndReturn() {
        FloorPlan existing = plan(1L, "旧名称");
        FloorPlan updateData = plan(1L, "新名称");
        FloorPlan updated = plan(1L, "新名称");
        when(floorPlanMapper.selectById(1L)).thenReturn(existing, updated);

        FloorPlan result = floorPlanService.update(1L, updateData);
        assertEquals("新名称", result.getName());
        verify(floorPlanMapper).updateById(updateData);
    }

    @Test
    void update_notFound_shouldThrow() {
        when(floorPlanMapper.selectById(999L)).thenReturn(null);
        assertThrows(BusinessException.class, () -> floorPlanService.update(999L, new FloorPlan()));
    }

    @Test
    void delete_existing_shouldCascadeClean() {
        when(floorPlanMapper.selectById(1L)).thenReturn(plan(1L, "待删除"));
        floorPlanService.delete(1L);
        verify(floorPlanMapper).delete(any(LambdaQueryWrapper.class));
        verify(floorPlanAssetMapper).delete(any(LambdaQueryWrapper.class));
    }

    @Test
    void delete_notFound_shouldThrow() {
        when(floorPlanMapper.selectById(999L)).thenReturn(null);
        assertThrows(BusinessException.class, () -> floorPlanService.delete(999L));
        verify(floorPlanMapper, never()).delete(any());
        verify(floorPlanAssetMapper, never()).delete(any());
    }

    @Test
    void getPlanAssets_shouldReturnList() {
        List<FloorPlanAsset> assets = List.of(asset(1L, 1L, 101L));
        when(floorPlanAssetMapper.selectWithAssetInfo(1L)).thenReturn(assets);
        assertEquals(1, floorPlanService.getPlanAssets(1L).size());
    }

    @Test
    void placeAsset_existing_shouldUpdate() {
        FloorPlanAsset existing = asset(1L, 1L, 101L);
        existing.setPosX(BigDecimal.ZERO);
        existing.setPosY(BigDecimal.ZERO);
        when(floorPlanAssetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(existing);

        FloorPlanAsset result = floorPlanService.placeAsset(1L, 101L, BigDecimal.TEN, BigDecimal.ONE, "新标签");
        assertEquals(BigDecimal.TEN, result.getPosX());
        assertEquals("新标签", result.getLabel());
        verify(floorPlanAssetMapper).updateById(existing);
        verify(floorPlanAssetMapper, never()).insert(any(FloorPlanAsset.class));
    }

    @Test
    void placeAsset_new_shouldInsert() {
        when(floorPlanAssetMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);
        FloorPlanAsset result = floorPlanService.placeAsset(1L, 999L, new BigDecimal("10.5"), new BigDecimal("20.3"), "新标记");
        assertEquals(1L, result.getPlanId());
        assertEquals(999L, result.getAssetId());
        verify(floorPlanAssetMapper).insert(any(FloorPlanAsset.class));
    }

    @Test
    void removeAsset_shouldDelete() {
        floorPlanService.removeAsset(1L, 101L);
        verify(floorPlanAssetMapper).delete(any(LambdaQueryWrapper.class));
    }
}
