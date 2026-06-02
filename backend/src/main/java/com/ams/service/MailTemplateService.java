package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.MailTemplateCreateDTO;
import com.ams.dto.MailTemplateUpdateDTO;
import com.ams.entity.MailTemplate;
import com.ams.mapper.MailTemplateMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * 邮件模板服务
 *
 * <p>提供邮件模板的 CRUD 操作、按编码查询缓存、变量渲染能力。</p>
 */
@Service
@RequiredArgsConstructor
public class MailTemplateService {

    private final MailTemplateMapper mailTemplateMapper;

    /**
     * 分页查询邮件模板
     */
    public Page<MailTemplate> queryPage(Integer page, Integer pageSize, String category, String keyword) {
        String tenantId = TenantContext.requireTenantId();
        Page<MailTemplate> pageParam = new Page<>(page == null ? 1 : page, pageSize == null ? 10 : pageSize);

        LambdaQueryWrapper<MailTemplate> wrapper = new LambdaQueryWrapper<MailTemplate>()
                .eq(MailTemplate::getTenantId, tenantId);

        if (category != null && !category.isBlank()) {
            wrapper.eq(MailTemplate::getCategory, category);
        }
        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like(MailTemplate::getTemplateName, keyword)
                    .or().like(MailTemplate::getTemplateCode, keyword));
        }
        wrapper.orderByDesc(MailTemplate::getCreateTime);

        return mailTemplateMapper.selectPage(pageParam, wrapper);
    }

    /**
     * 根据 ID 查询模板
     */
    public MailTemplate getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        MailTemplate template = mailTemplateMapper.selectOne(new LambdaQueryWrapper<MailTemplate>()
                .eq(MailTemplate::getId, id)
                .eq(MailTemplate::getTenantId, tenantId));
        if (template == null) {
            throw new BusinessException("邮件模板不存在");
        }
        return template;
    }

    /**
     * 根据编码查询模板
     */
    public MailTemplate getByCode(String templateCode) {
        String tenantId = TenantContext.requireTenantId();
        MailTemplate template = mailTemplateMapper.selectOne(new LambdaQueryWrapper<MailTemplate>()
                .eq(MailTemplate::getTemplateCode, templateCode)
                .eq(MailTemplate::getTenantId, tenantId));
        if (template == null) {
            throw new BusinessException("邮件模板不存在: " + templateCode);
        }
        return template;
    }

    /**
     * 创建邮件模板
     */
    @Transactional(rollbackFor = Exception.class)
    public MailTemplate create(MailTemplateCreateDTO createDTO) {
        String tenantId = TenantContext.requireTenantId();

        // 检查编码唯一性
        Long count = mailTemplateMapper.selectCount(new LambdaQueryWrapper<MailTemplate>()
                .eq(MailTemplate::getTemplateCode, createDTO.getTemplateCode())
                .eq(MailTemplate::getTenantId, tenantId));
        if (count > 0) {
            throw new BusinessException("模板编码已存在: " + createDTO.getTemplateCode());
        }

        MailTemplate template = new MailTemplate();
        BeanUtil.copyProperties(createDTO, template);
        template.setTenantId(tenantId);
        if (template.getStatus() == null) {
            template.setStatus(1);
        }
        mailTemplateMapper.insert(template);
        return template;
    }

    /**
     * 更新邮件模板
     */
    @Transactional(rollbackFor = Exception.class)
    public MailTemplate update(Long id, MailTemplateUpdateDTO updateDTO) {
        MailTemplate template = getById(id);

        // 内置模板只允许更新部分字段
        if (template.getIsBuiltin() != null && template.getIsBuiltin() == 1) {
            throw new BusinessException("内置模板不可修改，可新建自定义模板覆盖");
        }

        BeanUtil.copyProperties(updateDTO, template, "id", "templateCode", "isBuiltin", "createBy", "createTime");
        mailTemplateMapper.updateById(template);
        return template;
    }

    /**
     * 删除邮件模板（逻辑删除）
     */
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        MailTemplate template = getById(id);
        if (template.getIsBuiltin() != null && template.getIsBuiltin() == 1) {
            throw new BusinessException("内置模板不可删除");
        }
        mailTemplateMapper.deleteById(id);
    }

    /**
     * 渲染模板内容 — 将 ${varName} 替换为实际值
     *
     * @param templateContent 模板内容（包含 ${varName} 占位符）
     * @param variables       变量映射
     * @return 渲染后的文本
     */
    public String renderTemplate(String templateContent, Map<String, Object> variables) {
        if (templateContent == null) return "";
        if (variables == null || variables.isEmpty()) return templateContent;

        String result = templateContent;
        for (Map.Entry<String, Object> entry : variables.entrySet()) {
            String placeholder = "${" + entry.getKey() + "}";
            String value = entry.getValue() != null ? entry.getValue().toString() : "";
            result = result.replace(placeholder, value);
        }
        return result;
    }
}
