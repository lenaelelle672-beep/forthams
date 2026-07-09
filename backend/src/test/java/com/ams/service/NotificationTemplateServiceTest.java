package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.NotificationTemplateDTO;
import com.ams.dto.NotificationTemplateMetaDTO;
import com.ams.dto.NotificationTemplatePreviewRequestDTO;
import com.ams.dto.NotificationTemplatePreviewRespDTO;
import com.ams.dto.NotificationTemplateQueryDTO;
import com.ams.entity.NotificationTemplate;
import com.ams.mapper.NotificationTemplateMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationTemplateServiceTest {

    @Mock
    private NotificationTemplateMapper notificationTemplateMapper;

    private NotificationTemplateService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        service = new NotificationTemplateService(notificationTemplateMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void listDetailCodeAndMetaShouldRemainTenantScoped() {
        NotificationTemplateQueryDTO query = NotificationTemplateQueryDTO.builder()
                .page(1)
                .pageSize(20)
                .category("system")
                .channelType("IN_APP")
                .status(1)
                .keyword("资产")
                .build();
        when(notificationTemplateMapper.countRecords("tenant-a", "system", "IN_APP", 1, "资产")).thenReturn(1L);
        when(notificationTemplateMapper.selectPageRecords("tenant-a", "system", "IN_APP", 1, "资产", 20, 0)).thenReturn(List.of(template()));
        when(notificationTemplateMapper.selectByIdAndTenant("tenant-a", 3L)).thenReturn(template());
        when(notificationTemplateMapper.selectByCodeAndTenant("tenant-a", "SYS_NOTICE")).thenReturn(template());
        when(notificationTemplateMapper.listCategories("tenant-a", 100)).thenReturn(List.of("system"));
        when(notificationTemplateMapper.listChannelTypes("tenant-a", 100)).thenReturn(List.of("IN_APP"));

        NotificationTemplateDTO.PageResult page = service.list(query);
        assertEquals(1, page.getRecords().size());
        assertEquals(true, page.getTenantScoped());
        assertEquals("SYS_NOTICE", service.detail(3L).getTemplateCode());
        assertEquals("系统通知", service.getByCode("SYS_NOTICE").getTemplateName());
        NotificationTemplateMetaDTO meta = service.meta();
        assertEquals(true, meta.getTenantScoped());
        assertTrue(meta.getNonGoals().toString().contains("不发送通知"));

        verify(notificationTemplateMapper).countRecords("tenant-a", "system", "IN_APP", 1, "资产");
        verify(notificationTemplateMapper).selectByIdAndTenant("tenant-a", 3L);
        verify(notificationTemplateMapper).selectByCodeAndTenant("tenant-a", "SYS_NOTICE");
    }

    @Test
    void previewShouldEscapeHtmlReportMissingAndRejectSensitiveOrExtraVariables() {
        when(notificationTemplateMapper.selectByIdAndTenant("tenant-a", 3L)).thenReturn(template());
        Map<String, Object> variables = new LinkedHashMap<>();
        variables.put("assetName", "<script>alert(1)</script>");
        variables.put("password", rawSecret());
        variables.put("token", rawSecret());
        variables.put("extra", "outside");
        NotificationTemplatePreviewRequestDTO request = NotificationTemplatePreviewRequestDTO.builder()
                .templateId(3L)
                .variables(variables)
                .build();

        NotificationTemplatePreviewRespDTO response = service.preview(request);

        assertEquals(true, response.getNonPersistent());
        assertEquals(true, response.getHtmlEscaped());
        assertEquals(List.of("assetName"), response.getUsedVariables());
        assertTrue(response.getMissingVariables().contains("dueDate"));
        assertTrue(response.getRejectedVariables().stream().anyMatch(item -> "password".equals(item.getName())));
        assertTrue(response.getRejectedVariables().stream().anyMatch(item -> "token".equals(item.getName())));
        assertTrue(response.getRejectedVariables().stream().anyMatch(item -> "extra".equals(item.getName())));
        assertTrue(response.getRenderedTitle().contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assertFalse(response.getRenderedTitle().contains("<script>"));
        assertFalse(response.getRenderedContent().contains(rawSecret()));
    }

    @Test
    void previewWithoutTemplateShouldUseCurrentPlaceholdersAsWhitelistAndNeverPersist() {
        Map<String, Object> variables = new LinkedHashMap<>();
        variables.put("operatorName", "<Admin>");
        variables.put("clientSecret", rawSecret());
        NotificationTemplatePreviewRequestDTO request = NotificationTemplatePreviewRequestDTO.builder()
                .titleTemplate("操作人 {{operatorName}}")
                .contentTemplate("只预览 {{operatorName}}")
                .variables(variables)
                .build();

        NotificationTemplatePreviewRespDTO response = service.preview(request);

        assertEquals("操作人 &lt;Admin&gt;", response.getRenderedTitle());
        assertEquals(List.of("operatorName"), response.getUsedVariables());
        assertTrue(response.getRejectedVariables().stream().anyMatch(item -> "clientSecret".equals(item.getName())));
        assertTrue(response.getReadonlyBoundary().contains("不发送"));
        verifyNoInteractions(notificationTemplateMapper);
    }

    @Test
    void invalidTemplateAndMissingTenantShouldFailClosed() {
        when(notificationTemplateMapper.selectByIdAndTenant("tenant-a", 404L)).thenReturn(null);
        assertThrows(BusinessException.class, () -> service.detail(404L));

        TenantContext.clear();
        assertThrows(AccessDeniedException.class, () -> service.list(new NotificationTemplateQueryDTO()));
    }

    @Test
    void listShouldRequireTenantBeforeMapper() {
        TenantContext.clear();

        assertThrows(AccessDeniedException.class, () -> service.list(new NotificationTemplateQueryDTO()));
        verifyNoInteractions(notificationTemplateMapper);
    }

    private NotificationTemplate template() {
        NotificationTemplate template = new NotificationTemplate();
        template.setId(3L);
        template.setTenantId("tenant-a");
        template.setTemplateCode("SYS_NOTICE");
        template.setTemplateName("系统通知");
        template.setCategory("system");
        template.setChannelType("IN_APP");
        template.setTitleTemplate("资产 {{assetName}} 到期 {{dueDate}}");
        template.setContentTemplate("<b>{{assetName}}</b> {{token}} {{extra}}");
        template.setVariables("[\"assetName\",\"dueDate\",\"token\",\"password\"]");
        template.setStatus(1);
        return template;
    }

    private String rawSecret() {
        return "raw-notification-secret";
    }
}
