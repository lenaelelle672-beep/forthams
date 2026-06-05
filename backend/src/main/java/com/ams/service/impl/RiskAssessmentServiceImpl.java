package com.ams.service.impl;

import com.ams.entity.RiskAssessment;
import com.ams.mapper.RiskAssessmentMapper;
import com.ams.service.RiskAssessmentService;
import com.ams.service.RiskControlMeasureService;
import com.ams.service.RiskMatrixService;
import com.ams.context.TenantContext;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RiskAssessmentServiceImpl implements RiskAssessmentService {
    private final RiskAssessmentMapper riskAssessmentMapper;
    private final RiskControlMeasureService riskControlMeasureService;
    private final RiskMatrixService riskMatrixService;

    @Override
    public Page<RiskAssessment> list(String keyword, String riskLevel, Long assetId,
                                     Integer pageNum, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<RiskAssessment> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<RiskAssessment> wrapper = new LambdaQueryWrapper<RiskAssessment>()
                .eq(RiskAssessment::getTenantId, tenantId);
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(RiskAssessment::getMitigationMeasures, keyword));
        }
        if (riskLevel != null && !riskLevel.isEmpty()) {
            wrapper.eq(RiskAssessment::getRiskLevel, riskLevel);
        }
        if (assetId != null) {
            wrapper.eq(RiskAssessment::getAssetId, assetId);
        }
        wrapper.orderByDesc(RiskAssessment::getCreateTime);
        return riskAssessmentMapper.selectPage(page, wrapper);
    }

    @Override
    public Page<RiskAssessment> listWithSort(String keyword, String riskLevel, Long assetId,
                                              String sortBy, String sortOrder,
                                              Integer pageNum, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<RiskAssessment> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<RiskAssessment> wrapper = new LambdaQueryWrapper<RiskAssessment>()
                .eq(RiskAssessment::getTenantId, tenantId);
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(RiskAssessment::getMitigationMeasures, keyword));
        }
        if (riskLevel != null && !riskLevel.isEmpty()) {
            wrapper.eq(RiskAssessment::getRiskLevel, riskLevel);
        }
        if (assetId != null) {
            wrapper.eq(RiskAssessment::getAssetId, assetId);
        }

        // 多维度排序
        boolean isAsc = !"desc".equalsIgnoreCase(sortOrder);
        switch (sortBy) {
            case "riskLevel":
                // 按风险等级排序（CRITICAL > HIGH > MEDIUM > LOW）
                wrapper.orderBy(true, isAsc, RiskAssessment::getRiskLevel);
                break;
            case "probability":
                wrapper.orderBy(true, isAsc, RiskAssessment::getProbability);
                break;
            case "impact":
                wrapper.orderBy(true, isAsc, RiskAssessment::getImpact);
                break;
            case "createTime":
            default:
                wrapper.orderBy(true, !isAsc, RiskAssessment::getCreateTime);
                break;
        }

        return riskAssessmentMapper.selectPage(page, wrapper);
    }

    @Override
    public RiskAssessment getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return riskAssessmentMapper.selectOne(new LambdaQueryWrapper<RiskAssessment>()
                .eq(RiskAssessment::getId, id)
                .eq(RiskAssessment::getTenantId, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public RiskAssessment create(RiskAssessment assessment) {
        String tenantId = TenantContext.requireTenantId();
        assessment.setTenantId(tenantId);
        // 设置默认状态
        if (assessment.getStatus() == null || assessment.getStatus().isEmpty()) {
            assessment.setStatus("PENDING");
        }
        // 使用动态矩阵配置计算风险等级
        assessment.setRiskLevel(riskMatrixService.calculateRiskLevel(assessment.getProbability(), assessment.getImpact()));
        riskAssessmentMapper.insert(assessment);
        return assessment;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public RiskAssessment update(Long id, RiskAssessment assessment) {
        String tenantId = TenantContext.requireTenantId();
        RiskAssessment existing = getById(id);
        if (existing == null) {
            throw new IllegalArgumentException("RiskAssessment not found");
        }
        assessment.setId(id);
        assessment.setTenantId(tenantId);
        // 使用动态矩阵配置计算风险等级
        assessment.setRiskLevel(riskMatrixService.calculateRiskLevel(assessment.getProbability(), assessment.getImpact()));
        riskAssessmentMapper.updateById(assessment);
        return getById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        String tenantId = TenantContext.requireTenantId();
        RiskAssessment existing = getById(id);
        if (existing == null) {
            throw new IllegalArgumentException("RiskAssessment not found");
        }
        // 级联删除关联的控制措施
        riskControlMeasureService.deleteByRiskAssessmentId(id);
        // 删除风险评估
        riskAssessmentMapper.deleteById(id);
    }

    @Override
    public List<Map<String, Object>> getHeatmapData() {
        String tenantId = TenantContext.requireTenantId();
        return riskAssessmentMapper.selectHeatmapData(tenantId);
    }

    @Override
    public List<Map<String, Object>> getRiskLevelTrend(String startDate, String endDate, String period) {
        String tenantId = TenantContext.requireTenantId();
        return riskAssessmentMapper.selectRiskLevelTrend(tenantId, startDate, endDate, period);
    }
}
