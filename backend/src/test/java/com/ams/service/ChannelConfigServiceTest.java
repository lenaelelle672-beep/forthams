package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.ChannelConfigDTO;
import com.ams.dto.ChannelConfigMetaDTO;
import com.ams.dto.ChannelConfigPreviewRequestDTO;
import com.ams.dto.ChannelConfigPreviewRespDTO;
import com.ams.dto.ChannelConfigQueryDTO;
import com.ams.entity.ChannelConfig;
import com.ams.mapper.ChannelConfigMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChannelConfigServiceTest {

    @Mock
    private ChannelConfigMapper channelConfigMapper;

    private ChannelConfigService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        service = new ChannelConfigService(channelConfigMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void listDetailAndMetaShouldRemainTenantScopedAndMasked() {
        ChannelConfigQueryDTO query = new ChannelConfigQueryDTO();
        query.setPage(2);
        query.setPageSize(10);
        query.setChannelType("dingtalk");
        query.setKeyword("ops");
        when(channelConfigMapper.countRecords("tenant-a", "DINGTALK", "ops")).thenReturn(1L);
        when(channelConfigMapper.selectPageRecords("tenant-a", "DINGTALK", "ops", 10, 10)).thenReturn(List.of(config()));
        when(channelConfigMapper.selectByIdAndTenant("tenant-a", 7L)).thenReturn(config());
        when(channelConfigMapper.listChannelTypes("tenant-a", 100)).thenReturn(List.of("DINGTALK"));

        ChannelConfigDTO.PageResult page = service.list(query);
        assertEquals(1L, page.getTotal());
        assertEquals(2, page.getPage());
        assertEquals(true, page.getTenantScoped());
        assertEquals("https://example.com/***", page.getRecords().get(0).getWebhookUrlMasked());

        ChannelConfigDTO detail = service.detail(7L);
        assertEquals("tenant-a", detail.getTenantId());
        assertEquals(true, detail.getWebhookUrlConfigured());
        assertEquals(true, detail.getTenantScoped());

        ChannelConfigMetaDTO meta = service.meta();
        assertEquals(true, meta.getTenantScoped());
        assertEquals(true, meta.getNoSend());
        assertEquals(false, meta.getRuntimeEffect());
        assertTrue(meta.getNonGoals().toString().contains("不发送测试消息"));

        verify(channelConfigMapper).countRecords("tenant-a", "DINGTALK", "ops");
        verify(channelConfigMapper).selectPageRecords("tenant-a", "DINGTALK", "ops", 10, 10);
        verify(channelConfigMapper).selectByIdAndTenant("tenant-a", 7L);
        verify(channelConfigMapper).listChannelTypes("tenant-a", 100);
    }

    @Test
    void detailShouldFailClosedForInvalidOrCrossTenantMissingId() {
        assertThrows(BusinessException.class, () -> service.detail(0L));
        when(channelConfigMapper.selectByIdAndTenant("tenant-a", 99L)).thenReturn(null);
        assertThrows(BusinessException.class, () -> service.detail(99L));
        verify(channelConfigMapper).selectByIdAndTenant("tenant-a", 99L);
    }

    @Test
    void previewShouldRejectRawSecretsAndReturnNoPersistenceNoSendRuntimeEffectFalse() {
        ChannelConfigPreviewRequestDTO request = ChannelConfigPreviewRequestDTO.builder()
                .channelType("DINGTALK")
                .configName("运维群")
                .webhookUrlConfigured(true)
                .signatureConfigured(true)
                .enabled(1)
                .sampleEndpoint("/robot/send")
                .build();
        request.putUnknownInput("webhookUrl", "https://example.com/raw-token");
        request.putUnknownInput("secret", "raw-secret");
        request.putUnknownInput("tenantId", "tenant-b");

        ChannelConfigPreviewRespDTO response = service.preview(request);

        assertEquals("DINGTALK", response.getChannelType());
        assertEquals(true, response.getConfigured());
        assertEquals("已配置（脱敏）", response.getWebhookUrlMasked());
        assertEquals(true, response.getTenantScoped());
        assertEquals(true, response.getNoPersistence());
        assertEquals(true, response.getNoSend());
        assertEquals(false, response.getRuntimeEffect());
        assertFalse(response.getPreviewAccepted());
        assertTrue(response.getRejectedInputs().stream().anyMatch(item -> "webhookUrl".equals(item.getField())));
        assertTrue(response.getRejectedInputs().stream().anyMatch(item -> "secret".equals(item.getField())));
        assertTrue(response.getRejectedInputs().stream().anyMatch(item -> "tenantId".equals(item.getField())));
        verifyNoInteractions(channelConfigMapper);
    }

    @Test
    void previewShouldRejectAbsoluteEndpointWithoutEchoingIt() {
        ChannelConfigPreviewRespDTO response = service.preview(ChannelConfigPreviewRequestDTO.builder()
                .channelType("WECHAT")
                .configName("企业微信")
                .webhookUrlConfigured(true)
                .enabled(1)
                .sampleEndpoint("https://example.com/robot/send?token=raw")
                .build());

        assertEquals(false, response.getSampleEndpointAccepted());
        assertEquals(false, response.getPreviewAccepted());
        assertTrue(response.getRejectedInputs().stream().anyMatch(item -> "sampleEndpoint".equals(item.getField())));
        assertTrue(response.getReadonlyBoundary().contains("无持久化"));
    }

    @Test
    void missingTenantShouldFailClosedBeforeMapper() {
        TenantContext.clear();

        assertThrows(AccessDeniedException.class, () -> service.list(new ChannelConfigQueryDTO()));
        assertThrows(AccessDeniedException.class, () -> service.detail(7L));
        assertThrows(AccessDeniedException.class, () -> service.meta());
        assertThrows(AccessDeniedException.class, () -> service.preview(new ChannelConfigPreviewRequestDTO()));
        verifyNoInteractions(channelConfigMapper);
    }

    private ChannelConfig config() {
        ChannelConfig config = new ChannelConfig();
        config.setId(7L);
        config.setTenantId("tenant-a");
        config.setChannelType("DINGTALK");
        config.setConfigName("运维群");
        config.setWebhookUrlMasked("https://example.com/***");
        config.setWebhookUrlConfigured(true);
        config.setSignatureConfigured(true);
        config.setEnabled(1);
        config.setDescription("只读渠道");
        return config;
    }
}
