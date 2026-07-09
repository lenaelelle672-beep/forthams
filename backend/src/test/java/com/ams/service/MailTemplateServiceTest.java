package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.MailTemplateDTO;
import com.ams.dto.MailTemplateMetaDTO;
import com.ams.dto.MailTemplatePreviewRequestDTO;
import com.ams.dto.MailTemplatePreviewRespDTO;
import com.ams.dto.MailTemplateQueryDTO;
import com.ams.entity.MailTemplate;
import com.ams.mapper.MailTemplateMapper;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MailTemplateServiceTest {

    @Mock
    private MailTemplateMapper mailTemplateMapper;

    private MailTemplateService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        service = new MailTemplateService(mailTemplateMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void listDetailCodeAndMetaShouldRemainTenantScoped() {
        MailTemplateQueryDTO query = MailTemplateQueryDTO.builder()
                .page(1)
                .pageSize(20)
                .category("system")
                .contentType("HTML")
                .status(1)
                .keyword("资产")
                .build();
        when(mailTemplateMapper.countRecords("tenant-a", "system", "HTML", 1, "资产")).thenReturn(1L);
        when(mailTemplateMapper.selectPageRecords("tenant-a", "system", "HTML", 1, "资产", 20, 0)).thenReturn(List.of(template()));
        when(mailTemplateMapper.selectByIdAndTenant("tenant-a", 5L)).thenReturn(template());
        when(mailTemplateMapper.selectByCodeAndTenant("tenant-a", "ASSET_EXPIRE_MAIL")).thenReturn(template());
        when(mailTemplateMapper.listCategories("tenant-a", 100)).thenReturn(List.of("system"));
        when(mailTemplateMapper.listContentTypes("tenant-a", 100)).thenReturn(List.of("HTML"));

        MailTemplateDTO.PageResult page = service.list(query);
        assertEquals(1, page.getRecords().size());
        assertEquals(true, page.getTenantScoped());
        assertEquals("ASSET_EXPIRE_MAIL", service.detail(5L).getTemplateCode());
        assertEquals("资产到期邮件", service.getByCode("ASSET_EXPIRE_MAIL").getTemplateName());
        MailTemplateMetaDTO meta = service.meta();
        assertEquals(true, meta.getTenantScoped());
        assertTrue(meta.getNonGoals().toString().contains("不发送邮件"));

        verify(mailTemplateMapper).countRecords("tenant-a", "system", "HTML", 1, "资产");
        verify(mailTemplateMapper).selectByIdAndTenant("tenant-a", 5L);
        verify(mailTemplateMapper).selectByCodeAndTenant("tenant-a", "ASSET_EXPIRE_MAIL");
    }

    @Test
    void previewShouldEscapeHtmlReportMissingAndRejectSensitiveOrExtraVariables() {
        when(mailTemplateMapper.selectByIdAndTenant("tenant-a", 5L)).thenReturn(template());
        Map<String, Object> variables = new LinkedHashMap<>();
        variables.put("assetName", "<script>alert(1)</script>");
        variables.put("password", rawSecret());
        variables.put("token", rawSecret());
        variables.put("extra", "outside");
        MailTemplatePreviewRequestDTO request = MailTemplatePreviewRequestDTO.builder()
                .templateId(5L)
                .variables(variables)
                .build();

        MailTemplatePreviewRespDTO response = service.preview(request);

        assertEquals(true, response.getNonPersistent());
        assertEquals(true, response.getHtmlEscaped());
        assertEquals(List.of("assetName"), response.getUsedVariables());
        assertTrue(response.getMissingVariables().contains("dueDate"));
        assertTrue(response.getRejectedVariables().stream().anyMatch(item -> "password".equals(item.getName())));
        assertTrue(response.getRejectedVariables().stream().anyMatch(item -> "token".equals(item.getName())));
        assertTrue(response.getRejectedVariables().stream().anyMatch(item -> "extra".equals(item.getName())));
        assertTrue(response.getRenderedSubject().contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assertFalse(response.getRenderedSubject().contains("<script>"));
        assertFalse(response.getRenderedContent().contains(rawSecret()));
    }

    @Test
    void previewWithoutTemplateShouldUseCurrentPlaceholdersAsWhitelistAndNeverPersist() {
        Map<String, Object> variables = new LinkedHashMap<>();
        variables.put("operatorName", "<Admin>");
        variables.put("clientSecret", rawSecret());
        MailTemplatePreviewRequestDTO request = MailTemplatePreviewRequestDTO.builder()
                .subjectTemplate("操作人 {{operatorName}}")
                .contentTemplate("只预览 {{operatorName}}")
                .variables(variables)
                .build();

        MailTemplatePreviewRespDTO response = service.preview(request);

        assertEquals("操作人 &lt;Admin&gt;", response.getRenderedSubject());
        assertEquals(List.of("operatorName"), response.getUsedVariables());
        assertTrue(response.getRejectedVariables().stream().anyMatch(item -> "clientSecret".equals(item.getName())));
        assertTrue(response.getReadonlyBoundary().contains("不发送"));
        verifyNoInteractions(mailTemplateMapper);
    }

    @Test
    void invalidTemplateAndMissingTenantShouldFailClosed() {
        when(mailTemplateMapper.selectByIdAndTenant("tenant-a", 404L)).thenReturn(null);
        assertThrows(BusinessException.class, () -> service.detail(404L));

        TenantContext.clear();
        assertThrows(AccessDeniedException.class, () -> service.list(new MailTemplateQueryDTO()));
    }

    @Test
    void listShouldRequireTenantBeforeMapper() {
        TenantContext.clear();

        assertThrows(AccessDeniedException.class, () -> service.list(new MailTemplateQueryDTO()));
        verifyNoInteractions(mailTemplateMapper);
    }

    private MailTemplate template() {
        MailTemplate template = new MailTemplate();
        template.setId(5L);
        template.setTenantId("tenant-a");
        template.setTemplateCode("ASSET_EXPIRE_MAIL");
        template.setTemplateName("资产到期邮件");
        template.setCategory("system");
        template.setSubjectTemplate("资产 {{assetName}} 到期 {{dueDate}}");
        template.setContentTemplate("<b>{{assetName}}</b> {{token}} {{extra}}");
        template.setContentType("HTML");
        template.setVariables("[\"assetName\",\"dueDate\",\"token\",\"password\"]");
        template.setStatus(1);
        return template;
    }

    private String rawSecret() {
        return "raw-mail-secret";
    }
}
