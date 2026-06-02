package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.SystemConfig;
import com.ams.mapper.SystemConfigMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 系统配置服务
 *
 * <p>提供基于单表 KV + config_group 分区的系统配置/安全配置读写能力。
 * 遵循 debate.json 议题4 方案 A（单表 KV + config_group 分区）。
 */
@Service
@RequiredArgsConstructor
public class SystemConfigService {

    private final SystemConfigMapper systemConfigMapper;

    /** 系统配置分组 */
    public static final String GROUP_SYSTEM = "SYSTEM";
    /** 安全配置分组 */
    public static final String GROUP_SECURITY = "SECURITY";

    public Page<SystemConfig> getPage(Integer page, Integer pageSize, String configName, String configKey) {
        String tenantId = TenantContext.requireTenantId();
        QueryWrapper<SystemConfig> wrapper = new QueryWrapper<SystemConfig>()
                .eq("tenant_id", tenantId);
        if (configName != null && !configName.isBlank()) {
            wrapper.like("config_name", configName);
        }
        if (configKey != null && !configKey.isBlank()) {
            wrapper.like("config_key", configKey);
        }
        wrapper.orderByDesc("update_time");
        return systemConfigMapper.selectPage(new Page<>(page == null ? 1 : page, pageSize == null ? 10 : pageSize), wrapper);
    }

    public SystemConfig getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        SystemConfig config = systemConfigMapper.selectOne(new QueryWrapper<SystemConfig>()
                .eq("tenant_id", tenantId)
                .eq("id", id)
                .last("limit 1"));
        if (config == null) {
            throw new BusinessException("系统参数不存在");
        }
        return config;
    }

    public SystemConfig getByKey(String key) {
        String tenantId = TenantContext.requireTenantId();
        SystemConfig config = systemConfigMapper.selectOne(new QueryWrapper<SystemConfig>()
                .eq("tenant_id", tenantId)
                .eq("config_key", key)
                .last("limit 1"));
        if (config == null) {
            throw new BusinessException("系统参数不存在");
        }
        return config;
    }

    @Transactional(rollbackFor = Exception.class)
    public SystemConfig create(SystemConfig config) {
        String tenantId = TenantContext.requireTenantId();
        config.setTenantId(tenantId);
        if (config.getConfigGroup() == null || config.getConfigGroup().isBlank()) {
            config.setConfigGroup(GROUP_SYSTEM);
        }
        if (config.getConfigType() == null || config.getConfigType().isBlank()) {
            config.setConfigType("N");
        }
        if (config.getStatus() == null) {
            config.setStatus(0);
        }
        systemConfigMapper.insert(config);
        return config;
    }

    @Transactional(rollbackFor = Exception.class)
    public SystemConfig update(Long id, SystemConfig config) {
        SystemConfig existing = getById(id);
        if (config.getConfigGroup() != null) existing.setConfigGroup(config.getConfigGroup());
        if (config.getConfigKey() != null) existing.setConfigKey(config.getConfigKey());
        if (config.getConfigValue() != null) existing.setConfigValue(config.getConfigValue());
        if (config.getConfigName() != null) existing.setConfigName(config.getConfigName());
        if (config.getConfigType() != null) existing.setConfigType(config.getConfigType());
        if (config.getRemark() != null) existing.setRemark(config.getRemark());
        if (config.getStatus() != null) existing.setStatus(config.getStatus());
        systemConfigMapper.updateById(existing);
        return existing;
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        getById(id);
        systemConfigMapper.deleteById(id);
    }

    public void refreshCache() {
        // 当前配置服务直接读库，保留接口用于前端“刷新缓存”操作兼容。
    }

    /**
     * 获取指定分组的全部配置（Map 形式）。
     *
     * @param configGroup 配置分组（SYSTEM / SECURITY）
     * @return 配置键值对 Map
     */
    public Map<String, String> getConfigMap(String configGroup) {
        String tenantId = TenantContext.requireTenantId();
        List<SystemConfig> configs = systemConfigMapper.selectList(
                new QueryWrapper<SystemConfig>()
                        .eq("tenant_id", tenantId)
                        .eq("config_group", configGroup));

        Map<String, String> result = new HashMap<>();
        if (configs != null) {
            for (SystemConfig c : configs) {
                result.put(c.getConfigKey(), c.getConfigValue());
            }
        }
        return result;
    }

    /**
     * 批量保存配置（覆盖式）。
     * 先删除该分组下所有配置，再逐条插入。
     *
     * @param configGroup 配置分组（SYSTEM / SECURITY）
     * @param configMap   配置键值对
     */
    @Transactional(rollbackFor = Exception.class)
    public void saveConfigMap(String configGroup, Map<String, String> configMap) {
        if (configMap == null || configMap.isEmpty()) {
            return;
        }
        String tenantId = TenantContext.requireTenantId();

        // 删除该分组下已有配置
        systemConfigMapper.delete(new QueryWrapper<SystemConfig>()
                .eq("tenant_id", tenantId)
                .eq("config_group", configGroup));

        // 批量插入新配置
        List<SystemConfig> configs = configMap.entrySet().stream()
                .map(entry -> {
                    SystemConfig config = new SystemConfig();
                    config.setTenantId(tenantId);
                    config.setConfigGroup(configGroup);
                    config.setConfigKey(entry.getKey());
                    config.setConfigValue(entry.getValue());
                    config.setConfigName(entry.getKey());
                    config.setConfigType("N");
                    config.setStatus(0);
                    return config;
                })
                .collect(Collectors.toList());

        for (SystemConfig config : configs) {
            systemConfigMapper.insert(config);
        }
    }

    /**
     * 获取单个配置值。
     */
    public String getConfigValue(String configGroup, String configKey) {
        String tenantId = TenantContext.requireTenantId();
        SystemConfig config = systemConfigMapper.selectOne(
                new QueryWrapper<SystemConfig>()
                        .eq("tenant_id", tenantId)
                        .eq("config_group", configGroup)
                        .eq("config_key", configKey)
                        .last("limit 1"));
        return config == null ? null : config.getConfigValue();
    }
}
