package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.entity.SystemConfig;
import com.ams.mapper.SystemConfigMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SystemConfigServiceTest {

    @Mock
    private SystemConfigMapper systemConfigMapper;

    @InjectMocks
    private SystemConfigService systemConfigService;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void getConfigMapShouldMergeGlobalDefaultsWithTenantOverrides() {
        TenantContext.setTenantId("dept:1");
        when(systemConfigMapper.selectList(any(QueryWrapper.class)))
                .thenReturn(List.of(
                        config("GLOBAL", SystemConfigService.GROUP_SYSTEM, "ams.email.enabled", "true"),
                        config("GLOBAL", SystemConfigService.GROUP_SYSTEM, "ams.sms.enabled", "false")))
                .thenReturn(List.of(
                        config("dept:1", SystemConfigService.GROUP_SYSTEM, "ams.sms.enabled", "true")));

        Map<String, String> result = systemConfigService.getConfigMap(SystemConfigService.GROUP_SYSTEM);

        assertEquals("true", result.get("ams.email.enabled"));
        assertEquals("true", result.get("ams.sms.enabled"));
        verify(systemConfigMapper, times(2)).selectList(any(QueryWrapper.class));
    }

    @Test
    void getByKeyShouldFallbackToGlobalConfigWhenTenantValueIsMissing() {
        TenantContext.setTenantId("dept:1");
        SystemConfig global = config("GLOBAL", SystemConfigService.GROUP_SYSTEM, "ams.system.name", "forthAMS");
        when(systemConfigMapper.selectOne(any(QueryWrapper.class)))
                .thenReturn(null)
                .thenReturn(global);

        SystemConfig result = systemConfigService.getByKey("ams.system.name");

        assertEquals(global, result);
        verify(systemConfigMapper, times(2)).selectOne(any(QueryWrapper.class));
    }

    @Test
    void getByKeyShouldPreferTenantConfigOverGlobalConfig() {
        TenantContext.setTenantId("dept:1");
        SystemConfig tenant = config("dept:1", SystemConfigService.GROUP_SYSTEM, "ams.system.name", "Tenant AMS");
        when(systemConfigMapper.selectOne(any(QueryWrapper.class))).thenReturn(tenant);

        SystemConfig result = systemConfigService.getByKey("ams.system.name");

        assertEquals(tenant, result);
        verify(systemConfigMapper).selectOne(any(QueryWrapper.class));
    }

    @Test
    void getByKeyShouldThrowWhenTenantAndGlobalConfigAreMissing() {
        TenantContext.setTenantId("dept:1");
        when(systemConfigMapper.selectOne(any(QueryWrapper.class)))
                .thenReturn(null)
                .thenReturn(null);

        assertThrows(BusinessException.class, () -> systemConfigService.getByKey("missing.key"));
        verify(systemConfigMapper, times(2)).selectOne(any(QueryWrapper.class));
    }

    @Test
    void getConfigValueShouldFallbackToGlobalValue() {
        TenantContext.setTenantId("dept:1");
        when(systemConfigMapper.selectOne(any(QueryWrapper.class)))
                .thenReturn(null)
                .thenReturn(config("GLOBAL", SystemConfigService.GROUP_SECURITY, "password.minLength", "8"));

        String result = systemConfigService.getConfigValue(SystemConfigService.GROUP_SECURITY, "password.minLength");

        assertEquals("8", result);
        verify(systemConfigMapper, times(2)).selectOne(any(QueryWrapper.class));
    }

    @Test
    void getConfigMapShouldRequireTenantContext() {
        assertThrows(AccessDeniedException.class,
                () -> systemConfigService.getConfigMap(SystemConfigService.GROUP_SYSTEM));
    }

    private SystemConfig config(String tenantId, String group, String key, String value) {
        SystemConfig config = new SystemConfig();
        config.setTenantId(tenantId);
        config.setConfigGroup(group);
        config.setConfigKey(key);
        config.setConfigValue(value);
        return config;
    }
}
