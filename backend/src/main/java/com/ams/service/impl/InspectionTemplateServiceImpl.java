package com.ams.service.impl;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.InspectionTemplate;
import com.ams.mapper.InspectionTemplateMapper;
import com.ams.service.InspectionTemplateService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 检验模板服务实现
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InspectionTemplateServiceImpl implements InspectionTemplateService {

    private final InspectionTemplateMapper templateMapper;

    @Override
    public Page<InspectionTemplate> listTemplates(String keyword, String type, Integer pageNum, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<InspectionTemplate> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<InspectionTemplate> wrapper = new LambdaQueryWrapper<InspectionTemplate>()
                .eq(InspectionTemplate::getTenantId, tenantId);
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(InspectionTemplate::getTemplateName, keyword);
        }
        if (type != null && !type.isEmpty()) {
            wrapper.eq(InspectionTemplate::getType, type);
        }
        wrapper.orderByDesc(InspectionTemplate::getCreateTime);
        return templateMapper.selectPage(page, wrapper);
    }

    @Override
    public InspectionTemplate getTemplateById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return templateMapper.selectOne(new LambdaQueryWrapper<InspectionTemplate>()
                .eq(InspectionTemplate::getId, id)
                .eq(InspectionTemplate::getTenantId, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InspectionTemplate createTemplate(InspectionTemplate template) {
        String tenantId = TenantContext.requireTenantId();
        template.setTenantId(tenantId);
        if (template.getStatus() == null) {
            template.setStatus("ACTIVE");
        }
        if (template.getFrequency() == null || template.getFrequency() <= 0) {
            template.setFrequency(12); // 默认12个月
        }
        templateMapper.insert(template);
        log.info("创建检验模板: templateId={}, templateName={}", template.getId(), template.getTemplateName());
        return template;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InspectionTemplate updateTemplate(Long id, InspectionTemplate template) {
        String tenantId = TenantContext.requireTenantId();
        InspectionTemplate existing = getTemplateById(id);
        if (existing == null) {
            throw new BusinessException("检验模板不存在");
        }
        template.setId(id);
        template.setTenantId(tenantId);
        templateMapper.updateById(template);
        log.info("更新检验模板: templateId={}", id);
        return getTemplateById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public InspectionTemplate copyTemplate(Long id) {
        String tenantId = TenantContext.requireTenantId();
        InspectionTemplate existing = getTemplateById(id);
        if (existing == null) {
            throw new BusinessException("检验模板不存在");
        }

        InspectionTemplate copy = new InspectionTemplate();
        copy.setTemplateName(existing.getTemplateName() + " 副本");
        copy.setType(existing.getType());
        copy.setFrequency(existing.getFrequency());
        copy.setCategoryIds(existing.getCategoryIds());
        copy.setCheckItems(existing.getCheckItems());
        copy.setStatus(existing.getStatus() == null ? "ACTIVE" : existing.getStatus());
        copy.setTenantId(tenantId);
        copy.setCreateBy(existing.getCreateBy());
        templateMapper.insert(copy);
        log.info("复制检验模板: sourceTemplateId={}, copiedTemplateId={}", id, copy.getId());
        return copy;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteTemplate(Long id) {
        InspectionTemplate existing = getTemplateById(id);
        if (existing == null) {
            throw new BusinessException("检验模板不存在");
        }
        templateMapper.deleteById(id);
        log.info("删除检验模板: templateId={}", id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void toggleTemplateStatus(Long id, String status) {
        InspectionTemplate existing = getTemplateById(id);
        if (existing == null) {
            throw new BusinessException("检验模板不存在");
        }
        if (!"ACTIVE".equals(status) && !"DISABLED".equals(status)) {
            throw new BusinessException("无效的状态值");
        }
        existing.setStatus(status);
        templateMapper.updateById(existing);
        log.info("切换检验模板状态: templateId={}, status={}", id, status);
    }

    @Override
    public List<InspectionTemplate> getTemplatesByAssetCategory(Long assetCategoryId) {
        // 注意：这里需要根据 assetCategoryId 查找适用的模板
        // 简化实现：返回所有活跃模板，实际应用中可能需要扩展模板表增加 categoryIds 字段
        String tenantId = TenantContext.requireTenantId();
        return templateMapper.selectList(new LambdaQueryWrapper<InspectionTemplate>()
                .eq(InspectionTemplate::getTenantId, tenantId)
                .eq(InspectionTemplate::getStatus, "ACTIVE")
                .orderByAsc(InspectionTemplate::getTemplateName));
    }
}
