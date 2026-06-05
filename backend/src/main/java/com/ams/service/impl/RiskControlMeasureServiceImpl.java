package com.ams.service.impl;

import com.ams.entity.RiskControlMeasure;
import com.ams.mapper.RiskControlMeasureMapper;
import com.ams.service.RiskControlMeasureService;
import com.ams.context.TenantContext;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RiskControlMeasureServiceImpl implements RiskControlMeasureService {
    private final RiskControlMeasureMapper riskControlMeasureMapper;

    @Override
    public Page<RiskControlMeasure> listByRiskAssessment(Long riskAssessmentId, Integer pageNum, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<RiskControlMeasure> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<RiskControlMeasure> wrapper = new LambdaQueryWrapper<RiskControlMeasure>()
                .eq(RiskControlMeasure::getRiskAssessmentId, riskAssessmentId)
                .eq(RiskControlMeasure::getTenantId, tenantId)
                .orderByAsc(RiskControlMeasure::getPriority)
                .orderByDesc(RiskControlMeasure::getCreateTime);
        return riskControlMeasureMapper.selectPage(page, wrapper);
    }

    @Override
    public RiskControlMeasure getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return riskControlMeasureMapper.selectOne(new LambdaQueryWrapper<RiskControlMeasure>()
                .eq(RiskControlMeasure::getId, id)
                .eq(RiskControlMeasure::getTenantId, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public RiskControlMeasure create(RiskControlMeasure measure) {
        String tenantId = TenantContext.requireTenantId();
        measure.setTenantId(tenantId);
        // 设置默认状态
        if (measure.getStatus() == null || measure.getStatus().isEmpty()) {
            measure.setStatus("PENDING");
        }
        // 设置默认优先级
        if (measure.getPriority() == null) {
            measure.setPriority(3);
        }
        // 设置默认类型
        if (measure.getMeasureType() == null || measure.getMeasureType().isEmpty()) {
            measure.setMeasureType("MITIGATION");
        }
        riskControlMeasureMapper.insert(measure);
        return measure;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public RiskControlMeasure update(Long id, RiskControlMeasure measure) {
        String tenantId = TenantContext.requireTenantId();
        RiskControlMeasure existing = getById(id);
        if (existing == null) {
            throw new IllegalArgumentException("RiskControlMeasure not found");
        }
        measure.setId(id);
        measure.setTenantId(tenantId);
        riskControlMeasureMapper.updateById(measure);
        return getById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        String tenantId = TenantContext.requireTenantId();
        RiskControlMeasure existing = getById(id);
        if (existing == null) {
            throw new IllegalArgumentException("RiskControlMeasure not found");
        }
        riskControlMeasureMapper.deleteById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteByRiskAssessmentId(Long riskAssessmentId) {
        String tenantId = TenantContext.requireTenantId();
        riskControlMeasureMapper.delete(new LambdaQueryWrapper<RiskControlMeasure>()
                .eq(RiskControlMeasure::getRiskAssessmentId, riskAssessmentId)
                .eq(RiskControlMeasure::getTenantId, tenantId));
    }
}