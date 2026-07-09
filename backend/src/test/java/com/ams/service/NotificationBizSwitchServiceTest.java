package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.dto.NotificationBizSwitchDTO;
import com.ams.dto.NotificationBizSwitchMetaDTO;
import com.ams.dto.NotificationBizSwitchPreviewRequestDTO;
import com.ams.dto.NotificationBizSwitchPreviewRespDTO;
import com.ams.entity.NotificationBizSwitch;
import com.ams.mapper.NotificationBizSwitchMapper;
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
class NotificationBizSwitchServiceTest {

    @Mock
    private NotificationBizSwitchMapper notificationBizSwitchMapper;

    private NotificationBizSwitchService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        service = new NotificationBizSwitchService(notificationBizSwitchMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void listByBizTypeAndMetaShouldRemainTenantScoped() {
        when(notificationBizSwitchMapper.selectAllByTenant("tenant-a")).thenReturn(List.of(switchConfig()));
        when(notificationBizSwitchMapper.selectByBizTypeAndTenant("tenant-a", "maintenance")).thenReturn(List.of(switchConfig()));
        when(notificationBizSwitchMapper.listBizTypes("tenant-a", 100)).thenReturn(List.of("maintenance"));
        when(notificationBizSwitchMapper.listEvents("tenant-a", 100)).thenReturn(List.of("approved"));
        when(notificationBizSwitchMapper.listChannelTypes("tenant-a", 100)).thenReturn(List.of("IN_APP"));

        List<NotificationBizSwitchDTO> all = service.list();
        List<NotificationBizSwitchDTO> byBizType = service.getByBizType("maintenance");
        NotificationBizSwitchMetaDTO meta = service.meta();

        assertEquals(1, all.size());
        assertEquals(true, all.get(0).getTenantScoped());
        assertEquals("approved", byBizType.get(0).getEvent());
        assertEquals(true, meta.getTenantScoped());
        assertEquals(true, meta.getNoPersistencePreview());
        assertEquals(true, meta.getNoSend());
        assertEquals(false, meta.getWorkflowRuntimeEffect());
        assertTrue(meta.getNonGoals().toString().contains("不接入流程运行时"));
        verify(notificationBizSwitchMapper).selectAllByTenant("tenant-a");
        verify(notificationBizSwitchMapper).selectByBizTypeAndTenant("tenant-a", "maintenance");
    }

    @Test
    void previewShouldRejectOverridesAndReturnNoPersistenceNoSendRuntimeEffectFalse() {
        when(notificationBizSwitchMapper.selectForPreview("tenant-a", "maintenance", "approved", "IN_APP")).thenReturn(List.of(switchConfig()));
        NotificationBizSwitchPreviewRequestDTO request = NotificationBizSwitchPreviewRequestDTO.builder()
                .bizType("maintenance")
                .event("approved")
                .channelType("IN_APP")
                .enabled(1)
                .build();
        request.putUnknownInput("tenantId", "tenant-b");
        request.putUnknownInput("workflowDefinitionId", "wf-1");
        request.putUnknownInput("runtimeContext", "raw-context");

        NotificationBizSwitchPreviewRespDTO response = service.preview(request);

        assertEquals(false, response.getWouldNotify());
        assertEquals(true, response.getBlockedBySwitch());
        assertEquals(1, response.getMatchedSwitches().size());
        assertTrue(response.getRejectedInputs().stream().anyMatch(item -> "tenantId".equals(item.getField())));
        assertTrue(response.getRejectedInputs().stream().anyMatch(item -> "workflowDefinitionId".equals(item.getField())));
        assertTrue(response.getRejectedInputs().stream().anyMatch(item -> "runtimeContext".equals(item.getField())));
        assertEquals(true, response.getTenantScoped());
        assertEquals(true, response.getNoPersistence());
        assertEquals(true, response.getNoSend());
        assertEquals(false, response.getWorkflowRuntimeEffect());
        assertTrue(response.getReadonlyBoundary().contains("不写库"));
        verify(notificationBizSwitchMapper).selectForPreview("tenant-a", "maintenance", "approved", "IN_APP");
    }

    @Test
    void previewShouldReportMissingSwitchWithoutWritingOrSending() {
        when(notificationBizSwitchMapper.selectForPreview("tenant-a", "maintenance", "submitted", "EMAIL")).thenReturn(List.of());

        NotificationBizSwitchPreviewRespDTO response = service.preview(NotificationBizSwitchPreviewRequestDTO.builder()
                .bizType("maintenance")
                .event("submitted")
                .channelType("EMAIL")
                .enabled(1)
                .build());

        assertFalse(response.getWouldNotify());
        assertFalse(response.getBlockedBySwitch());
        assertTrue(response.getMissingSwitches().contains("maintenance:submitted:EMAIL"));
        assertEquals(true, response.getNoPersistence());
        assertEquals(true, response.getNoSend());
        assertEquals(false, response.getWorkflowRuntimeEffect());
    }

    @Test
    void missingTenantShouldFailClosedBeforeMapper() {
        TenantContext.clear();

        assertThrows(AccessDeniedException.class, () -> service.list());
        assertThrows(AccessDeniedException.class, () -> service.getByBizType("maintenance"));
        assertThrows(AccessDeniedException.class, () -> service.meta());
        assertThrows(AccessDeniedException.class, () -> service.preview(new NotificationBizSwitchPreviewRequestDTO()));
        verifyNoInteractions(notificationBizSwitchMapper);
    }

    private NotificationBizSwitch switchConfig() {
        NotificationBizSwitch switchConfig = new NotificationBizSwitch();
        switchConfig.setId(9L);
        switchConfig.setTenantId("tenant-a");
        switchConfig.setBizType("maintenance");
        switchConfig.setEvent("approved");
        switchConfig.setChannelType("IN_APP");
        switchConfig.setEnabled(0);
        switchConfig.setTemplateCode("MAINT_APPROVED");
        switchConfig.setDescription("只读流程通知开关");
        return switchConfig;
    }
}
