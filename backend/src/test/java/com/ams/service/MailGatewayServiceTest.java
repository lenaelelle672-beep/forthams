package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.MailGatewayDTO;
import com.ams.dto.MailGatewayMetaDTO;
import com.ams.dto.MailGatewayPreviewRequestDTO;
import com.ams.dto.MailGatewayPreviewRespDTO;
import com.ams.dto.MailGatewayQueryDTO;
import com.ams.entity.MailGateway;
import com.ams.mapper.MailGatewayMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MailGatewayServiceTest {

    @Mock
    private MailGatewayMapper mailGatewayMapper;

    private MailGatewayService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        service = new MailGatewayService(mailGatewayMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void listShouldFilterByTenantAndReturnOnlyMaskedMetadata() {
        when(mailGatewayMapper.countRecords(eq("tenant-a"), eq("smtp"), eq("STARTTLS"), eq(true), eq(true))).thenReturn(1L);
        when(mailGatewayMapper.selectPageRecords(eq("tenant-a"), eq("smtp"), eq("STARTTLS"), eq(true), eq(true), eq(100), eq(0))).thenReturn(List.of(gateway()));

        MailGatewayDTO.PageResult result = service.list(MailGatewayQueryDTO.builder()
                .keyword("smtp")
                .tlsMode("starttls")
                .enabled(true)
                .authConfigured(true)
                .pageSize(200)
                .build());

        assertEquals(1, result.getTotal());
        assertEquals(100, result.getPageSize());
        assertEquals("smtp-main", result.getRecords().get(0).getGatewayCode());
        assertEquals("smtp.***.corp", result.getRecords().get(0).getHostMasked());
        assertEquals("n***@c***", result.getRecords().get(0).getSenderMasked());
        assertEquals(true, result.getRecords().get(0).getTenantScoped());
        assertEquals(true, result.getRecords().get(0).getReadOnly());
        verify(mailGatewayMapper).countRecords(eq("tenant-a"), eq("smtp"), eq("STARTTLS"), eq(true), eq(true));
        verify(mailGatewayMapper).selectPageRecords(eq("tenant-a"), eq("smtp"), eq("STARTTLS"), eq(true), eq(true), eq(100), eq(0));
    }

    @Test
    void detailShouldFailClosedForInvalidOrCrossTenantRows() {
        assertThrows(BusinessException.class, () -> service.detail(0L));

        when(mailGatewayMapper.selectByIdAndTenant("tenant-a", 7L)).thenReturn(null);
        assertThrows(BusinessException.class, () -> service.detail(7L));

        when(mailGatewayMapper.selectByIdAndTenant("tenant-a", 8L)).thenReturn(gateway());
        MailGatewayDTO detail = service.detail(8L);
        assertEquals("smtp-main", detail.getGatewayCode());
        assertEquals(true, detail.getReadOnly());
    }

    @Test
    void metaShouldAdvertiseNoPersistenceNoSendNoNetworkBoundary() {
        when(mailGatewayMapper.listTlsModes("tenant-a", 100)).thenReturn(List.of("STARTTLS"));
        when(mailGatewayMapper.listLastTestStatuses("tenant-a", 100)).thenReturn(List.of("SUCCESS"));

        MailGatewayMetaDTO meta = service.meta();

        assertEquals(true, meta.getTenantScoped());
        assertEquals(true, meta.getReadOnly());
        assertEquals(true, meta.getNoPersistencePreview());
        assertEquals(true, meta.getNoSend());
        assertEquals(true, meta.getNoNetwork());
        assertEquals(false, meta.getRuntimeEffect());
        assertEquals(false, meta.getCacheRefreshed());
        assertEquals(false, meta.getCredentialExposed());
        assertEquals(false, meta.getSmtpConnect());
        assertEquals(false, meta.getJavaMailSenderUsed());
        assertEquals(false, meta.getMailSenderProviderUsed());
        assertTrue(meta.getPreviewPolicy().getRejectedInputFields().contains("smtpPassword"));
        assertTrue(meta.getNonGoals().toString().contains("不代表邮件子系统"));
    }

    @Test
    void previewShouldRejectSensitiveInputsWithoutPersistenceNetworkOrProviderUse() {
        MailGatewayPreviewRequestDTO request = MailGatewayPreviewRequestDTO.builder()
                .gatewayCode("smtp-main")
                .gatewayName("主邮件网关")
                .hostMasked("smtp.***.corp")
                .port(587)
                .tlsMode("starttls")
                .authConfigured(true)
                .senderMasked("n***@c***")
                .priority(10)
                .enabled(true)
                .build();
        request.putUnknownInput("password", null);
        request.putUnknownInput("authorization", null);
        request.putUnknownInput("sendTo", null);
        request.putUnknownInput("tenantId", "tenant-b");

        MailGatewayPreviewRespDTO response = service.preview(request);

        assertEquals(false, response.getPreviewAccepted());
        assertEquals(true, response.getConfigured());
        assertTrue(response.getAcceptedFields().contains("hostMasked"));
        assertTrue(response.getRejectedInputs().stream().anyMatch(item -> "password".equals(item.getField())));
        assertTrue(response.getRejectedInputs().stream().anyMatch(item -> "authorization".equals(item.getField())));
        assertTrue(response.getRejectedInputs().stream().anyMatch(item -> "sendTo".equals(item.getField())));
        assertTrue(response.getRejectedInputs().stream().anyMatch(item -> "tenantId".equals(item.getField())));
        assertEquals(true, response.getNoPersistence());
        assertEquals(true, response.getNoSend());
        assertEquals(true, response.getNoNetwork());
        assertEquals(false, response.getRuntimeEffect());
        assertEquals(false, response.getCacheRefreshed());
        assertEquals(false, response.getCredentialExposed());
        assertEquals(false, response.getSmtpConnect());
        assertEquals(false, response.getJavaMailSenderUsed());
        assertEquals(false, response.getMailSenderProviderUsed());
        assertFalse(response.getRejectedInputs().toString().contains("tenant-b"));
        verifyNoInteractions(mailGatewayMapper);
    }

    @Test
    void missingTenantShouldFailClosedBeforeMapper() {
        TenantContext.clear();

        assertThrows(AccessDeniedException.class, () -> service.list(new MailGatewayQueryDTO()));
        assertThrows(AccessDeniedException.class, () -> service.detail(1L));
        assertThrows(AccessDeniedException.class, () -> service.meta());
        assertThrows(AccessDeniedException.class, () -> service.preview(new MailGatewayPreviewRequestDTO()));
        verifyNoInteractions(mailGatewayMapper);
    }

    private MailGateway gateway() {
        MailGateway gateway = new MailGateway();
        gateway.setId(8L);
        gateway.setTenantId("tenant-a");
        gateway.setGatewayCode("smtp-main");
        gateway.setGatewayName("主邮件网关");
        gateway.setHostMasked("smtp.***.corp");
        gateway.setPort(587);
        gateway.setTlsMode("STARTTLS");
        gateway.setAuthConfigured(true);
        gateway.setSenderMasked("n***@c***");
        gateway.setPriority(10);
        gateway.setEnabled(true);
        gateway.setLastTestStatus("SUCCESS");
        gateway.setLastTestAt(LocalDateTime.of(2026, 7, 8, 9, 10));
        return gateway;
    }
}
