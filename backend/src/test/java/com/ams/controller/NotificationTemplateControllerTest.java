package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.NotificationTemplateDTO;
import com.ams.dto.NotificationTemplateMetaDTO;
import com.ams.dto.NotificationTemplatePreviewRespDTO;
import com.ams.service.NotificationTemplateService;
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
class NotificationTemplateControllerTest {

    @Mock
    private NotificationTemplateService notificationTemplateService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new NotificationTemplateController(notificationTemplateService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void shouldExposeOnlyTemplateCatalogAndPreviewRoutes() throws Exception {
        when(notificationTemplateService.list(any())).thenReturn(page());
        when(notificationTemplateService.detail(3L)).thenReturn(template());
        when(notificationTemplateService.getByCode("SYS_NOTICE")).thenReturn(template());
        when(notificationTemplateService.meta()).thenReturn(meta());
        when(notificationTemplateService.preview(any())).thenReturn(preview());

        mockMvc.perform(get("/notification-templates/list?page=1&pageSize=20&category=system&channelType=IN_APP"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[0].templateCode").value("SYS_NOTICE"))
                .andExpect(jsonPath("$.data.tenantScoped").value(true));

        mockMvc.perform(get("/notification-templates/3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.templateName").value("系统通知"));

        mockMvc.perform(get("/notification-templates/code/SYS_NOTICE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.templateCode").value("SYS_NOTICE"));

        mockMvc.perform(get("/notification-templates/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.previewVariablePolicy.nonPersistent").value(true));

        mockMvc.perform(post("/notification-templates/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateId\":3,\"variables\":{\"assetName\":\"资产A\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.nonPersistent").value(true))
                .andExpect(jsonPath("$.data.renderedTitle").value("资产A"));

        verify(notificationTemplateService).list(any());
        verify(notificationTemplateService).detail(3L);
        verify(notificationTemplateService).getByCode("SYS_NOTICE");
        verify(notificationTemplateService).meta();
        verify(notificationTemplateService).preview(any());

        mockMvc.perform(post("/notification-templates").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
        for (var builder : List.of(
                put("/notification-templates/3"),
                patch("/notification-templates/3"),
                delete("/notification-templates/3"),
                post("/notification-templates/send"),
                post("/notification-templates/test-send"),
                post("/notification-templates/export")
        )) {
            mockMvc.perform(builder.contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isMethodNotAllowed());
        }
    }

    @Test
    void shouldReturnForbiddenWhenTenantBoundaryFailsClosedInService() throws Exception {
        when(notificationTemplateService.list(any())).thenThrow(new AccessDeniedException("Missing tenant identifier"));

        mockMvc.perform(get("/notification-templates/list"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    private NotificationTemplateDTO.PageResult page() {
        return NotificationTemplateDTO.PageResult.builder()
                .records(List.of(template()))
                .total(1)
                .size(20)
                .current(1)
                .pages(1)
                .tenantScoped(true)
                .readonlyBoundary("通知模板 catalog + safe preview")
                .build();
    }

    private NotificationTemplateDTO template() {
        return NotificationTemplateDTO.builder()
                .id(3L)
                .tenantId("tenant-a")
                .templateCode("SYS_NOTICE")
                .templateName("系统通知")
                .category("system")
                .channelType("IN_APP")
                .titleTemplate("{{assetName}}")
                .contentTemplate("正文")
                .variables("[\"assetName\"]")
                .status(1)
                .tenantScoped(true)
                .build();
    }

    private NotificationTemplateMetaDTO meta() {
        return NotificationTemplateMetaDTO.builder()
                .previewVariablePolicy(NotificationTemplateMetaDTO.PreviewVariablePolicy.builder()
                        .nonPersistent(true)
                        .htmlEscaped(true)
                        .whitelistOnly(true)
                        .build())
                .tenantScoped(true)
                .build();
    }

    private NotificationTemplatePreviewRespDTO preview() {
        return NotificationTemplatePreviewRespDTO.builder()
                .renderedTitle("资产A")
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
