package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.WebhookConfig;
import com.ams.mapper.WebhookConfigMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class WebhookConfigService {

    private final WebhookConfigMapper webhookConfigMapper;

    public Page<WebhookConfig> queryPage(Integer page, Integer pageSize, String keyword) {
        Page<WebhookConfig> pageParam = new Page<>(page, pageSize);
        LambdaQueryWrapper<WebhookConfig> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            wrapper.like(WebhookConfig::getName, keyword);
        }
        wrapper.orderByDesc(WebhookConfig::getCreatedAt);
        return webhookConfigMapper.selectPage(pageParam, wrapper);
    }

    public WebhookConfig getById(Long id) {
        WebhookConfig config = webhookConfigMapper.selectById(id);
        if (config == null) throw new BusinessException("Webhook配置不存在");
        return config;
    }

    public List<WebhookConfig> getEnabledByEvent(String event) {
        return webhookConfigMapper.selectList(new LambdaQueryWrapper<WebhookConfig>()
                .eq(WebhookConfig::getEnabled, 1)
                .like(WebhookConfig::getEvents, event));
    }

    @Transactional(rollbackFor = Exception.class)
    public WebhookConfig create(WebhookConfig config) {
        if (config.getEnabled() == null) config.setEnabled(1);
        webhookConfigMapper.insert(config);
        return config;
    }

    @Transactional(rollbackFor = Exception.class)
    public WebhookConfig update(Long id, WebhookConfig config) {
        getById(id);
        config.setId(id);
        webhookConfigMapper.updateById(config);
        return webhookConfigMapper.selectById(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        getById(id);
        webhookConfigMapper.deleteById(id);
    }
}
