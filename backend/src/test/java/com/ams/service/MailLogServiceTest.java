package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.MailLogDTO;
import com.ams.dto.MailLogDetailDTO;
import com.ams.dto.MailLogMetaDTO;
import com.ams.dto.MailLogQueryDTO;
import com.ams.entity.MailLog;
import com.ams.mapper.MailLogMapper;
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
class MailLogServiceTest {

    @Mock
    private MailLogMapper mailLogMapper;

    private MailLogService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        service = new MailLogService(mailLogMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void listDetailBizAndMetaShouldRemainTenantScopedAndRedacted() {
        MailLogQueryDTO query = MailLogQueryDTO.builder()
                .page(1)
                .pageSize(20)
                .templateCode("ASSET_NOTIFY")
                .sendStatus("failed")
                .bizType("asset")
                .bizId(18L)
                .keyword("asset")
                .build();
        when(mailLogMapper.countRecords("tenant-a", "ASSET_NOTIFY", "FAILED", "asset", 18L, "asset")).thenReturn(1L);
        when(mailLogMapper.selectPageRecords("tenant-a", "ASSET_NOTIFY", "FAILED", "asset", 18L, "asset", 20, 0)).thenReturn(List.of(rawLog()));
        when(mailLogMapper.selectByIdAndTenant("tenant-a", 7L)).thenReturn(rawLog());
        when(mailLogMapper.selectByBizAndTenant("tenant-a", "asset", 18L, 50)).thenReturn(List.of(rawLog()));
        when(mailLogMapper.listSendStatuses("tenant-a", 100)).thenReturn(List.of("FAILED"));
        when(mailLogMapper.listBizTypes("tenant-a", 100)).thenReturn(List.of("asset"));
        when(mailLogMapper.listTemplateCodes("tenant-a", 100)).thenReturn(List.of("ASSET_NOTIFY"));

        MailLogDTO.PageResult page = service.list(query);
        MailLogDTO listItem = page.getRecords().get(0);
        MailLogDetailDTO detail = service.detail(7L);
        List<MailLogDTO> bizLogs = service.getByBiz("asset", 18L);
        MailLogMetaDTO meta = service.meta();

        assertEquals(true, page.getTenantScoped());
        assertEquals(true, page.getRedacted());
        assertEquals("o***@e***", listItem.getMaskedMailTo());
        assertEquals("主题已脱敏，长度=3", detail.getMaskedSubject());
        assertTrue(detail.getDiagnosticSummary().contains("错误详情已脱敏"));
        assertTrue(detail.getDiagnosticSummary().contains("供应商标识、请求标识、头信息与载荷已隐藏"));
        assertEquals(1, bizLogs.size());
        assertEquals(false, meta.getCollectionGuaranteed());
        assertTrue(meta.getNonGoals().toString().contains("不提供 retry/replay/resend"));

        String combined = page.toString() + detail + bizLogs + meta;
        assertFalse(combined.contains("ops@example.com"));
        assertFalse(combined.contains("工资单"));
        assertFalse(combined.contains("raw-content-secret"));
        assertFalse(combined.contains("smtp exploded"));
        assertFalse(combined.contains("provider-raw-id"));
        assertFalse(combined.contains("request-raw-id"));

        verify(mailLogMapper).countRecords("tenant-a", "ASSET_NOTIFY", "FAILED", "asset", 18L, "asset");
        verify(mailLogMapper).selectByIdAndTenant("tenant-a", 7L);
        verify(mailLogMapper).selectByBizAndTenant("tenant-a", "asset", 18L, 50);
    }

    @Test
    void invalidDetailBizAndMissingTenantShouldFailClosed() {
        when(mailLogMapper.selectByIdAndTenant("tenant-a", 404L)).thenReturn(null);
        assertThrows(BusinessException.class, () -> service.detail(404L));
        assertThrows(BusinessException.class, () -> service.getByBiz("", 18L));
        assertThrows(BusinessException.class, () -> service.getByBiz("asset", 0L));

        TenantContext.clear();
        assertThrows(AccessDeniedException.class, () -> service.list(new MailLogQueryDTO()));
    }

    @Test
    void listShouldRequireTenantBeforeMapper() {
        TenantContext.clear();

        assertThrows(AccessDeniedException.class, () -> service.list(new MailLogQueryDTO()));
        verifyNoInteractions(mailLogMapper);
    }

    private MailLog rawLog() {
        MailLog log = new MailLog();
        log.setId(7L);
        log.setTenantId("tenant-a");
        log.setTemplateCode("ASSET_NOTIFY");
        log.setMailFrom("noreply@example.com");
        log.setMailTo("ops@example.com");
        log.setMailCc("leader@example.com");
        log.setMailBcc("audit@example.com");
        log.setSubject("工资单");
        log.setContent("raw-content-secret");
        log.setSendStatus("FAILED");
        log.setErrorMessage("smtp exploded");
        log.setRetryCount(1);
        log.setMaxRetry(3);
        log.setBizType("asset");
        log.setBizId(18L);
        log.setProvider("smtp-provider");
        log.setProviderMessageId("provider-raw-id");
        log.setRequestId("request-raw-id");
        log.setHeaders("raw-header");
        log.setPayload("raw-payload");
        return log;
    }
}
