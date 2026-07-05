package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SystemWebhookConfigRequest;
import com.ams.dto.SystemWebhookConfigResponse;
import com.ams.dto.SystemWebhookConfigTestResponse;
import com.ams.entity.SystemWebhookConfig;
import com.ams.mapper.SystemWebhookConfigMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SystemWebhookConfigServiceTest {

    @Mock
    private SystemWebhookConfigMapper webhookConfigMapper;

    private SystemWebhookConfigService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        service = new SystemWebhookConfigService(webhookConfigMapper);
        lenient().when(webhookConfigMapper.insert(any(SystemWebhookConfig.class))).thenAnswer(invocation -> {
            SystemWebhookConfig config = invocation.getArgument(0);
            config.setId(7L);
            return 1;
        });
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void createShouldMaskSensitiveWebhookFieldsAndAvoidRawSecretPersistence() {
        SystemWebhookConfigRequest request = validRequest();
        request.setTargetUrl("https://hooks.example.com/asset/sync?token=raw-token#secret-fragment");
        request.setSecret("raw-secret");
        request.setHeaders(Map.of(
                "Authorization", "Bearer raw-token",
                "X-Webhook-Token", "raw-header-secret"
        ));

        SystemWebhookConfigResponse created = service.create(request);

        assertEquals("tenant-a", created.getTenantId());
        assertEquals("Webhook 资产同步", created.getConfigName());
        assertEquals("ASSET_SYNC", created.getEventType());
        assertEquals("https://hooks.example.com/asset/sync", created.getMaskedTargetUrl());
        assertTrue(created.getSecretConfigured());
        assertTrue(created.getSignatureConfigured());
        assertEquals("HMAC_SHA256", created.getSigningStrategy());
        assertEquals("******", created.getMaskedHeaders().get("Authorization"));
        assertEquals("******", created.getMaskedHeaders().get("X-Webhook-Token"));
        assertFalse(created.getMaskedTargetUrl().contains("raw-token"));
        assertFalse(created.getMaskedTargetUrl().contains("secret-fragment"));

        ArgumentCaptor<SystemWebhookConfig> captor = ArgumentCaptor.forClass(SystemWebhookConfig.class);
        verify(webhookConfigMapper).insert(captor.capture());
        SystemWebhookConfig persisted = captor.getValue();
        assertEquals("https://hooks.example.com/asset/sync", persisted.getTargetUrl());
        assertEquals("Authorization\nX-Webhook-Token", persisted.getMaskedHeaderNames());
        assertTrue(persisted.getSecretConfigured());
        assertTrue(persisted.getSignatureConfigured());
        assertFalse(persisted.getTargetUrl().contains("raw-token"));
        assertFalse(persisted.getMaskedHeaderNames().contains("raw-header-secret"));
    }

    @Test
    void createShouldRejectUnsafeUrlAndUnknownSignatureStrategy() {
        SystemWebhookConfigRequest localhost = validRequest();
        localhost.setTargetUrl("http://localhost/internal");
        assertThrows(BusinessException.class, () -> service.create(localhost));

        SystemWebhookConfigRequest metadata = validRequest();
        metadata.setTargetUrl("http://169.254.169.254/latest/meta-data");
        assertThrows(BusinessException.class, () -> service.create(metadata));

        SystemWebhookConfigRequest unknownSignature = validRequest();
        unknownSignature.setSigningStrategy("PLAIN_TEXT");
        assertThrows(BusinessException.class, () -> service.create(unknownSignature));

        verifyNoInteractions(webhookConfigMapper);
    }

    @Test
    void hmacStrategyShouldRequireSigningSecret() {
        SystemWebhookConfigRequest request = validRequest();
        request.setSigningSecret(null);

        assertThrows(BusinessException.class, () -> service.create(request));
        verifyNoInteractions(webhookConfigMapper);
    }

    @Test
    void listGetAndTestShouldStayTenantScoped() {
        TenantContext.setTenantId("tenant-b");
        when(webhookConfigMapper.selectList(any(QueryWrapper.class))).thenReturn(java.util.List.of());
        when(webhookConfigMapper.selectOne(any(QueryWrapper.class))).thenReturn(null);

        assertTrue(service.list().isEmpty());
        assertThrows(BusinessException.class, () -> service.get(7L));
        assertThrows(BusinessException.class, () -> service.testConfig(7L));
    }

    @Test
    void testConfigShouldBeConfigOnlyWithoutExternalCall() {
        SystemWebhookConfig stored = storedConfig(true);
        when(webhookConfigMapper.selectOne(any(QueryWrapper.class))).thenReturn(stored);

        SystemWebhookConfigTestResponse response = service.testConfig(stored.getId());

        assertTrue(response.getValid());
        assertTrue(response.getConfigOnly());
        assertEquals(stored.getId(), response.getConfigId());
        assertEquals("https://hooks.example.com/asset/sync", response.getTarget());
        assertEquals("Webhook 配置校验通过，未触发真实外部调用", response.getMessage());
    }

    @Test
    void deleteShouldRequireWebhookConfigDisabledFirst() {
        SystemWebhookConfig enabled = storedConfig(true);
        SystemWebhookConfig reloaded = storedConfig(true);
        when(webhookConfigMapper.selectOne(any(QueryWrapper.class))).thenReturn(enabled, reloaded, reloaded);
        when(webhookConfigMapper.selectList(any(QueryWrapper.class))).thenReturn(java.util.List.of());

        assertThrows(BusinessException.class, () -> service.delete(7L));

        SystemWebhookConfigResponse disabled = service.updateStatus(7L, false);
        assertFalse(disabled.getEnabled());
        assertEquals("DISABLED", disabled.getStatus());

        service.delete(7L);

        assertTrue(service.list().isEmpty());
        verify(webhookConfigMapper).updateById(reloaded);
        verify(webhookConfigMapper).deleteById(7L);
    }

    @Test
    void updateShouldKeepExistingHmacSecretWithoutPersistingRawReplacement() {
        SystemWebhookConfig stored = storedConfig(true);
        stored.setSignatureConfigured(true);
        when(webhookConfigMapper.selectOne(any(QueryWrapper.class))).thenReturn(stored);
        SystemWebhookConfigRequest request = validRequest();
        request.setSigningSecret(null);
        request.setHeaders(Map.of("X-Webhook-Token", "raw-update-token"));

        SystemWebhookConfigResponse updated = service.update(7L, request);

        assertTrue(updated.getSignatureConfigured());
        assertEquals("******", updated.getMaskedHeaders().get("X-Webhook-Token"));
        ArgumentCaptor<SystemWebhookConfig> captor = ArgumentCaptor.forClass(SystemWebhookConfig.class);
        verify(webhookConfigMapper).updateById(captor.capture());
        assertEquals("X-Webhook-Token", captor.getValue().getMaskedHeaderNames());
        assertFalse(captor.getValue().getMaskedHeaderNames().contains("raw-update-token"));
    }

    private SystemWebhookConfigRequest validRequest() {
        SystemWebhookConfigRequest request = new SystemWebhookConfigRequest();
        request.setConfigName("Webhook 资产同步");
        request.setEventType("ASSET_SYNC");
        request.setTargetUrl("https://hooks.example.com/asset/sync");
        request.setSigningStrategy("HMAC_SHA256");
        request.setSigningSecret("raw-signing-secret");
        request.setEnabled(true);
        return request;
    }

    private SystemWebhookConfig storedConfig(boolean enabled) {
        SystemWebhookConfig config = new SystemWebhookConfig();
        config.setId(7L);
        config.setTenantId("tenant-a");
        config.setConfigName("Webhook 资产同步");
        config.setEventType("ASSET_SYNC");
        config.setTargetUrl("https://hooks.example.com/asset/sync");
        config.setEnabled(enabled);
        config.setStatus(enabled ? "ENABLED" : "DISABLED");
        config.setSigningStrategy("HMAC_SHA256");
        config.setSecretConfigured(true);
        config.setSignatureConfigured(true);
        config.setMaskedHeaderNames("Authorization");
        config.setCreateTime(LocalDateTime.now().minusDays(1));
        config.setUpdateTime(LocalDateTime.now());
        config.setDeleted(0);
        return config;
    }
}
