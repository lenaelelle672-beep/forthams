package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.NotificationTemplateCreateDTO;
import com.ams.dto.NotificationTemplateUpdateDTO;
import com.ams.entity.NotificationTemplate;
import com.ams.mapper.NotificationTemplateMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

/**
 * 通知模板服务
 *
 * <p>提供通知模板的 CRUD 操作、按编码查询、变量渲染能力。</p>
 */
@Service
@RequiredArgsConstructor
public class NotificationTemplateService {

    private final NotificationTemplateMapper notificationTemplateMapper;

    /**
     * 分页查询通知模板
     */
    public Page<NotificationTemplate> queryPage(Integer page, Integer pageSize, String category, String keyword) {
        String tenantId = TenantContext.requireTenantId();
        Page<NotificationTemplate> pageParam = new Page<>(page == null ? 1 : page, pageSize == null ? 10 : pageSize);

        LambdaQueryWrapper<NotificationTemplate> wrapper = new LambdaQueryWrapper<NotificationTemplate>()
                .eq(NotificationTemplate::getTenantId, tenantId);

        if (category != null && !category.isBlank()) {
            wrapper.eq(NotificationTemplate::getCategory, category);
        }
        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like(NotificationTemplate::getTemplateName, keyword)
                    .or().like(NotificationTemplate::getTemplateCode, keyword));
        }
        wrapper.orderByDesc(NotificationTemplate::getCreateTime);

        return notificationTemplateMapper.selectPage(pageParam, wrapper);
    }

    /**
     * 根据 ID 查询模板
     */
    public NotificationTemplate getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        NotificationTemplate template = notificationTemplateMapper.selectOne(new LambdaQueryWrapper<NotificationTemplate>()
                .eq(NotificationTemplate::getId, id)
                .eq(NotificationTemplate::getTenantId, tenantId));
        if (template == null) {
            throw new BusinessException("通知模板不存在");
        }
        return template;
    }

    /**
     * 根据编码查询模板（忽略租户隔离，内置模板全局可用）
     */
    public NotificationTemplate getByCode(String templateCode) {
        NotificationTemplate template = notificationTemplateMapper.selectOne(
                new LambdaQueryWrapper<NotificationTemplate>()
                        .eq(NotificationTemplate::getTemplateCode, templateCode)
                        .last("LIMIT 1"));
        if (template == null) {
            throw new BusinessException("通知模板不存在: " + templateCode);
        }
        return template;
    }

    /**
     * 创建通知模板
     */
    @Transactional(rollbackFor = Exception.class)
    public NotificationTemplate create(NotificationTemplateCreateDTO createDTO) {
        String tenantId = TenantContext.requireTenantId();

        // 检查编码唯一性
        Long count = notificationTemplateMapper.selectCount(new LambdaQueryWrapper<NotificationTemplate>()
                .eq(NotificationTemplate::getTemplateCode, createDTO.getTemplateCode())
                .eq(NotificationTemplate::getTenantId, tenantId));
        if (count > 0) {
            throw new BusinessException("模板编码已存在: " + createDTO.getTemplateCode());
        }

        NotificationTemplate template = new NotificationTemplate();
        BeanUtil.copyProperties(createDTO, template);
        template.setTenantId(tenantId);
        if (template.getStatus() == null) {
            template.setStatus(1);
        }
        if (template.getChannelType() == null) {
            template.setChannelType("ALL");
        }
        notificationTemplateMapper.insert(template);
        return template;
    }

    /**
     * 更新通知模板
     */
    @Transactional(rollbackFor = Exception.class)
    public NotificationTemplate update(Long id, NotificationTemplateUpdateDTO updateDTO) {
        NotificationTemplate template = getById(id);

        // 内置模板不允许修改
        if (template.getIsBuiltin() != null && template.getIsBuiltin() == 1) {
            throw new BusinessException("内置模板不可修改，可新建自定义模板覆盖");
        }

        BeanUtil.copyProperties(updateDTO, template, "id", "templateCode", "isBuiltin", "createBy", "createTime");
        notificationTemplateMapper.updateById(template);
        return template;
    }

    /**
     * 删除通知模板（逻辑删除）
     */
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        NotificationTemplate template = getById(id);
        if (template.getIsBuiltin() != null && template.getIsBuiltin() == 1) {
            throw new BusinessException("内置模板不可删除");
        }
        notificationTemplateMapper.deleteById(id);
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
