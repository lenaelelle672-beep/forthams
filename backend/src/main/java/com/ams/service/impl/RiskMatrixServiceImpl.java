package com.ams.service.impl;

import com.ams.entity.RiskMatrix;
import com.ams.context.TenantContext;
import com.ams.mapper.RiskMatrixMapper;
import com.ams.service.RiskMatrixService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * 风险矩阵配置服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RiskMatrixServiceImpl implements RiskMatrixService {

    private final RiskMatrixMapper riskMatrixMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public Page<RiskMatrix> list(Integer pageNum, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<RiskMatrix> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<RiskMatrix> wrapper = new LambdaQueryWrapper<RiskMatrix>()
                .eq(RiskMatrix::getTenantId, tenantId)
                .orderByDesc(RiskMatrix::getCreateTime);
        return riskMatrixMapper.selectPage(page, wrapper);
    }

    @Override
    public RiskMatrix getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return riskMatrixMapper.selectOne(new LambdaQueryWrapper<RiskMatrix>()
                .eq(RiskMatrix::getId, id)
                .eq(RiskMatrix::getTenantId, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public RiskMatrix create(RiskMatrix matrix) {
        String tenantId = TenantContext.requireTenantId();
        matrix.setTenantId(tenantId);
        if (matrix.getIsActive() == null) {
            matrix.setIsActive(1);
        }
        riskMatrixMapper.insert(matrix);
        log.info("创建风险矩阵配置成功，ID: {}, 租户: {}", matrix.getId(), tenantId);
        return matrix;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public RiskMatrix update(Long id, RiskMatrix matrix) {
        String tenantId = TenantContext.requireTenantId();
        RiskMatrix existing = getById(id);
        if (existing == null) {
            throw new IllegalArgumentException("风险矩阵配置不存在");
        }
        matrix.setId(id);
        matrix.setTenantId(tenantId);
        riskMatrixMapper.updateById(matrix);
        log.info("更新风险矩阵配置成功，ID: {}, 租户: {}", id, tenantId);
        return getById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        String tenantId = TenantContext.requireTenantId();
        RiskMatrix existing = getById(id);
        if (existing == null) {
            throw new IllegalArgumentException("风险矩阵配置不存在");
        }
        riskMatrixMapper.deleteById(id);
        log.info("删除风险矩阵配置成功，ID: {}, 租户: {}", id, tenantId);
    }

    @Override
    public List<RiskMatrix> getActiveMatrix() {
        String tenantId = TenantContext.requireTenantId();
        return riskMatrixMapper.selectActiveByTenant(tenantId);
    }

    @Override
    public String calculateRiskLevel(Integer probability, Integer severity) {
        if (probability == null || severity == null) {
            return "LOW";
        }

        // 获取租户启用的矩阵配置
        List<RiskMatrix> matrices = getActiveMatrix();
        if (matrices.isEmpty()) {
            // 如果没有配置，使用默认规则
            return calculateDefaultRiskLevel(probability, severity);
        }

        try {
            RiskMatrix matrix = matrices.get(0);
            List<Map<String, Object>> levelMappings = objectMapper.readValue(
                    matrix.getLevelMapping(),
                    new TypeReference<List<Map<String, Object>>>() {}
            );

            int score = probability * severity;
            for (Map<String, Object> mapping : levelMappings) {
                Integer minScore = (Integer) mapping.get("minScore");
                String level = (String) mapping.get("level");
                if (score >= minScore) {
                    return level;
                }
            }
        } catch (Exception e) {
            log.error("解析矩阵配置失败，使用默认规则", e);
        }

        return calculateDefaultRiskLevel(probability, severity);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void setActive(Long id, Integer active) {
        String tenantId = TenantContext.requireTenantId();
        RiskMatrix existing = getById(id);
        if (existing == null) {
            throw new IllegalArgumentException("风险矩阵配置不存在");
        }

        RiskMatrix update = new RiskMatrix();
        update.setId(id);
        update.setIsActive(active);
        riskMatrixMapper.updateById(update);

        // 如果启用此矩阵，则禁用其他矩阵（确保只有一个激活）
        if (active == 1) {
            RiskMatrix otherUpdate = new RiskMatrix();
            otherUpdate.setIsActive(0);
            riskMatrixMapper.update(otherUpdate,
                    new LambdaQueryWrapper<RiskMatrix>()
                            .eq(RiskMatrix::getTenantId, tenantId)
                            .ne(RiskMatrix::getId, id)
            );
        }

        log.info("{}风险矩阵配置，ID: {}, 租户: {}",
                active == 1 ? "启用" : "禁用", id, tenantId);
    }

    /**
     * 默认风险等级计算规则
     * CRITICAL: probability * severity >= 20
     * HIGH: probability * severity >= 10
     * MEDIUM: probability * severity >= 4
     * LOW: probability * severity < 4
     */
    private String calculateDefaultRiskLevel(Integer probability, Integer severity) {
        int score = probability * severity;
        if (score >= 20) return "CRITICAL";
        if (score >= 10) return "HIGH";
        if (score >= 4) return "MEDIUM";
        return "LOW";
    }
}