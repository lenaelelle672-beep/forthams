package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.SystemConfig;
import com.ams.mapper.SystemConfigMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
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
