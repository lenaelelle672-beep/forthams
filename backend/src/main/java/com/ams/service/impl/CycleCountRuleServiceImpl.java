package com.ams.service.impl;

import com.ams.entity.CycleCountRule;
import com.ams.mapper.CycleCountRuleMapper;
import com.ams.service.CycleCountRuleService;
import com.ams.context.TenantContext;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CycleCountRuleServiceImpl implements CycleCountRuleService {
    private final CycleCountRuleMapper cycleCountRuleMapper;

    @Override
    public Page<CycleCountRule> list(String classification, Integer pageNum, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<CycleCountRule> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<CycleCountRule> wrapper = new LambdaQueryWrapper<CycleCountRule>()
                .eq(CycleCountRule::getTenantId, tenantId);
        if (classification != null && !classification.isEmpty()) {
            wrapper.eq(CycleCountRule::getClassification, classification);
        }
        wrapper.orderByAsc(CycleCountRule::getClassification);
        return cycleCountRuleMapper.selectPage(page, wrapper);
    }

    @Override
    public CycleCountRule getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return cycleCountRuleMapper.selectOne(new LambdaQueryWrapper<CycleCountRule>()
                .eq(CycleCountRule::getId, id)
                .eq(CycleCountRule::getTenantId, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CycleCountRule create(CycleCountRule rule) {
        String tenantId = TenantContext.requireTenantId();
        rule.setTenantId(tenantId);
        cycleCountRuleMapper.insert(rule);
        return rule;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CycleCountRule update(Long id, CycleCountRule rule) {
        String tenantId = TenantContext.requireTenantId();
        CycleCountRule existing = getById(id);
        if (existing == null) {
            throw new IllegalArgumentException("CycleCountRule not found");
        }
        rule.setId(id);
        rule.setTenantId(tenantId);
        cycleCountRuleMapper.updateById(rule);
        return getById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        String tenantId = TenantContext.requireTenantId();
        CycleCountRule existing = getById(id);
        if (existing == null) {
            throw new IllegalArgumentException("CycleCountRule not found");
        }
        cycleCountRuleMapper.deleteById(id);
    }

    @Override
    public List<CycleCountRule> listAll() {
        String tenantId = TenantContext.requireTenantId();
        return cycleCountRuleMapper.selectList(new LambdaQueryWrapper<CycleCountRule>()
                .eq(CycleCountRule::getTenantId, tenantId));
    }
}
