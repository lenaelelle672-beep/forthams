package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.MailTemplateDTO;
import com.ams.dto.MailTemplateMetaDTO;
import com.ams.dto.MailTemplatePreviewRespDTO;
import com.ams.service.MailTemplateService;
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
class MailTemplateControllerTest {

    @Mock
    private MailTemplateService mailTemplateService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new MailTemplateController(mailTemplateService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void shouldExposeOnlyTemplateCatalogAndPreviewRoutes() throws Exception {
        when(mailTemplateService.list(any())).thenReturn(page());
        when(mailTemplateService.detail(5L)).thenReturn(template());
        when(mailTemplateService.getByCode("ASSET_EXPIRE_MAIL")).thenReturn(template());
        when(mailTemplateService.meta()).thenReturn(meta());
        when(mailTemplateService.preview(any())).thenReturn(preview());

        mockMvc.perform(get("/mail-templates/list?page=1&pageSize=20&category=system&contentType=HTML"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[0].templateCode").value("ASSET_EXPIRE_MAIL"))
                .andExpect(jsonPath("$.data.tenantScoped").value(true));

        mockMvc.perform(get("/mail-templates/5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.templateName").value("资产到期邮件"));

        mockMvc.perform(get("/mail-templates/code/ASSET_EXPIRE_MAIL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.templateCode").value("ASSET_EXPIRE_MAIL"));

        mockMvc.perform(get("/mail-templates/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.previewVariablePolicy.nonPersistent").value(true));

        mockMvc.perform(post("/mail-templates/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":5,\"variables\":{\"assetName\":\"资产A\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nonPersistent").value(true))
                .andExpect(jsonPath("$.data.renderedSubject").value("资产A"));

        verify(mailTemplateService).list(any());
        verify(mailTemplateService).detail(5L);
        verify(mailTemplateService).getByCode("ASSET_EXPIRE_MAIL");
        verify(mailTemplateService).meta();
        verify(mailTemplateService).preview(any());

        for (var builder : List.of(
                post("/mail-templates"),
                put("/mail-templates/5"),
                patch("/mail-templates/5"),
                delete("/mail-templates/5"),
                post("/mail-templates/send"),
                post("/mail-templates/test-send"),
                post("/mail-templates/export")
        )) {
            mockMvc.perform(builder.contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().is5xxServerError());
        }
    }

    @Test
    void shouldReturnForbiddenWhenTenantBoundaryFailsClosedInService() throws Exception {
        when(mailTemplateService.list(any())).thenThrow(new AccessDeniedException("Missing tenant identifier"));

        mockMvc.perform(get("/mail-templates/list"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    private MailTemplateDTO.PageResult page() {
        return MailTemplateDTO.PageResult.builder()
                .records(List.of(template()))
                .total(1)
                .size(20)
                .current(1)
                .pages(1)
                .tenantScoped(true)
                .readonlyBoundary("邮件模板 catalog + safe preview")
                .build();
    }

    private MailTemplateDTO template() {
        return MailTemplateDTO.builder()
                .id(5L)
                .tenantId("tenant-a")
                .templateCode("ASSET_EXPIRE_MAIL")
                .templateName("资产到期邮件")
                .category("system")
                .subjectTemplate("{{assetName}}")
                .contentTemplate("正文")
                .contentType("HTML")
                .variables("[\"assetName\"]")
                .status(1)
                .tenantScoped(true)
                .build();
    }

    private MailTemplateMetaDTO meta() {
        return MailTemplateMetaDTO.builder()
                .previewVariablePolicy(MailTemplateMetaDTO.PreviewVariablePolicy.builder()
                        .nonPersistent(true)
                        .htmlEscaped(true)
                        .whitelistOnly(true)
                        .build())
                .tenantScoped(true)
                .build();
    }

    private MailTemplatePreviewRespDTO preview() {
        return MailTemplatePreviewRespDTO.builder()
                .renderedSubject("资产A")
                .renderedContent("正文")
                .missingVariables(List.of())
                .rejectedVariables(List.of())
                .usedVariables(List.of("assetName"))
                .nonPersistent(true)
                .tenantScoped(true)
                .htmlEscaped(true)
                .build();
    }
}
