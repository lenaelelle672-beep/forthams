package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.common.exception.BusinessException;
import com.ams.dto.ChannelConfigDTO;
import com.ams.dto.ChannelConfigMetaDTO;
import com.ams.dto.ChannelConfigPreviewRespDTO;
import com.ams.service.ChannelConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ChannelConfigControllerTest {

    @Mock
    private ChannelConfigService channelConfigService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new ChannelConfigController(channelConfigService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void shouldExposeOnlyListDetailMetaAndNoSendPreviewRoutes() throws Exception {
        when(channelConfigService.list(any())).thenReturn(ChannelConfigDTO.PageResult.builder()
                .records(List.of(config()))
                .total(1L)
                .page(1)
                .pageSize(20)
                .tenantScoped(true)
                .readonlyBoundary("只读通知渠道目录")
                .build());
        when(channelConfigService.detail(7L)).thenReturn(config());
        when(channelConfigService.detail(99L)).thenThrow(new BusinessException("通知渠道配置不存在"));
        when(channelConfigService.meta()).thenReturn(meta());
        when(channelConfigService.preview(any())).thenReturn(preview());

        mockMvc.perform(get("/system/channel-configs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[0].channelType").value("DINGTALK"))
                .andExpect(jsonPath("$.data.tenantScoped").value(true));

        mockMvc.perform(get("/system/channel-configs/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.webhookUrlMasked").value("https://example.com/***"))
                .andExpect(jsonPath("$.data.tenantScoped").value(true));

        mockMvc.perform(get("/system/channel-configs/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.noPersistencePreview").value(true))
                .andExpect(jsonPath("$.data.noSend").value(true))
                .andExpect(jsonPath("$.data.runtimeEffect").value(false));

        mockMvc.perform(post("/system/channel-configs/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"channelType\":\"DINGTALK\",\"configName\":\"运维群\",\"webhookUrlConfigured\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.noPersistence").value(true))
                .andExpect(jsonPath("$.data.noSend").value(true))
                .andExpect(jsonPath("$.data.runtimeEffect").value(false));

        mockMvc.perform(get("/system/channel-configs/99"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500));

        verify(channelConfigService).list(any());
        verify(channelConfigService).detail(7L);
        verify(channelConfigService).detail(99L);
        verify(channelConfigService).meta();
        verify(channelConfigService).preview(any());

        for (var builder : List.of(
                post("/system/channel-configs"),
                put("/system/channel-configs/7"),
                patch("/system/channel-configs/7"),
                delete("/system/channel-configs/7"),
                post("/system/channel-configs/DINGTALK/test"),
                post("/system/channel-configs/test")
        )) {
            mockMvc.perform(builder.contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(result -> assertTrue(result.getResponse().getStatus() >= 400));
        }
    }

    @Test
    void shouldReturnForbiddenWhenTenantBoundaryFailsClosedInService() throws Exception {
        when(channelConfigService.list(any())).thenThrow(new AccessDeniedException("Missing tenant identifier"));

        mockMvc.perform(get("/system/channel-configs"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    private ChannelConfigDTO config() {
        return ChannelConfigDTO.builder()
                .id(7L)
                .tenantId("tenant-a")
                .channelType("DINGTALK")
                .configName("运维群")
                .webhookUrlMasked("https://example.com/***")
                .webhookUrlConfigured(true)
                .signatureConfigured(true)
                .enabled(1)
                .tenantScoped(true)
                .readonlyBoundary("只读通知渠道目录")
                .build();
    }

    private ChannelConfigMetaDTO meta() {
        return ChannelConfigMetaDTO.builder()
                .channelTypes(List.of(ChannelConfigMetaDTO.Option.builder().value("DINGTALK").label("钉钉").build()))
                .noPersistencePreview(true)
                .noSend(true)
                .runtimeEffect(false)
                .tenantScoped(true)
                .build();
    }

    private ChannelConfigPreviewRespDTO preview() {
        return ChannelConfigPreviewRespDTO.builder()
                .channelType("DINGTALK")
                .configName("运维群")
                .configured(true)
                .webhookUrlConfigured(true)
                .webhookUrlMasked("已配置（脱敏）")
                .signatureConfigured(true)
                .enabled(1)
                .sampleEndpointAccepted(true)
                .previewAccepted(true)
                .rejectedInputs(List.of())
                .tenantScoped(true)
                .noPersistence(true)
                .noSend(true)
                .runtimeEffect(false)
                .readonlyBoundary("只读通知渠道目录")
                .build();
    }
}
