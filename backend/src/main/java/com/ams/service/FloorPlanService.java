package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.FloorPlan;
import com.ams.entity.FloorPlanAsset;
import com.ams.mapper.FloorPlanMapper;
import com.ams.mapper.FloorPlanAssetMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FloorPlanService {

    private final FloorPlanMapper floorPlanMapper;
    private final FloorPlanAssetMapper floorPlanAssetMapper;

    public Page<FloorPlan> listPage(Integer page, Integer pageSize, String keyword) {
        LambdaQueryWrapper<FloorPlan> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            wrapper.like(FloorPlan::getName, keyword);
        }
        wrapper.orderByDesc(FloorPlan::getCreatedAt);
        return floorPlanMapper.selectPage(new Page<>(page, pageSize), wrapper);
    }

    public FloorPlan getById(Long id) {
        FloorPlan plan = floorPlanMapper.selectById(id);
        if (plan == null) throw new BusinessException("平面图不存在");
        return plan;
    }

    @Transactional(rollbackFor = Exception.class)
    public FloorPlan create(FloorPlan plan) {
        floorPlanMapper.insert(plan);
        return plan;
    }

    @Transactional(rollbackFor = Exception.class)
    public FloorPlan update(Long id, FloorPlan plan) {
        getById(id);
        plan.setId(id);
        floorPlanMapper.updateById(plan);
        return floorPlanMapper.selectById(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        getById(id);
        floorPlanMapper.delete(new LambdaQueryWrapper<FloorPlan>().eq(FloorPlan::getId, id));
        floorPlanAssetMapper.delete(new LambdaQueryWrapper<FloorPlanAsset>().eq(FloorPlanAsset::getPlanId, id));
    }

    public List<FloorPlanAsset> getPlanAssets(Long planId) {
        return floorPlanAssetMapper.selectWithAssetInfo(planId);
    }

    @Transactional(rollbackFor = Exception.class)
    public FloorPlanAsset placeAsset(Long planId, Long assetId, BigDecimal posX, BigDecimal posY, String label) {
        FloorPlanAsset existing = floorPlanAssetMapper.selectOne(new LambdaQueryWrapper<FloorPlanAsset>()
                .eq(FloorPlanAsset::getPlanId, planId)
                .eq(FloorPlanAsset::getAssetId, assetId));
        if (existing != null) {
            existing.setPosX(posX);
            existing.setPosY(posY);
            existing.setLabel(label);
            floorPlanAssetMapper.updateById(existing);
            return existing;
        }
        FloorPlanAsset fpa = new FloorPlanAsset();
        fpa.setPlanId(planId);
        fpa.setAssetId(assetId);
        fpa.setPosX(posX);
        fpa.setPosY(posY);
        fpa.setLabel(label);
        floorPlanAssetMapper.insert(fpa);
        return fpa;
    }

    @Transactional(rollbackFor = Exception.class)
    public void removeAsset(Long planId, Long assetId) {
        floorPlanAssetMapper.delete(new LambdaQueryWrapper<FloorPlanAsset>()
                .eq(FloorPlanAsset::getPlanId, planId)
                .eq(FloorPlanAsset::getAssetId, assetId));
    }
}
