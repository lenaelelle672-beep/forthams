package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.common.exception.BusinessException;
import com.ams.dto.NotificationPreferenceDTO;
import com.ams.dto.NotificationPreferenceMetaDTO;
import com.ams.dto.NotificationPreferencePreviewRespDTO;
import com.ams.service.NotificationPreferenceService;
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
class NotificationPreferenceControllerTest {

    @Mock
    private NotificationPreferenceService notificationPreferenceService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new NotificationPreferenceController(notificationPreferenceService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void shouldExposeOnlyReadOnlyCatalogMetaAndPreviewRoutes() throws Exception {
        when(notificationPreferenceService.list()).thenReturn(List.of(preference()));
        when(notificationPreferenceService.getByCategory("system")).thenReturn(preference());
        when(notificationPreferenceService.getByCategory("batch")).thenThrow(new BusinessException("通知偏好分类不在只读目录中"));
        when(notificationPreferenceService.meta()).thenReturn(meta());
        when(notificationPreferenceService.preview(any())).thenReturn(preview());

        mockMvc.perform(get("/notification-preferences"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].category").value("system"))
                .andExpect(jsonPath("$.data[0].tenantScoped").value(true));

        mockMvc.perform(get("/notification-preferences/system"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.inApp").value(1));

        mockMvc.perform(get("/notification-preferences/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.noPersistencePreview").value(true))
                .andExpect(jsonPath("$.data.runtimeEffect").value(false));

        mockMvc.perform(post("/notification-preferences/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"system\",\"channelType\":\"IN_APP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.noPersistence").value(true))
                .andExpect(jsonPath("$.data.runtimeEffect").value(false));

        mockMvc.perform(get("/notification-preferences/batch"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(500));

        verify(notificationPreferenceService).list();
        verify(notificationPreferenceService).getByCategory("system");
        verify(notificationPreferenceService).getByCategory("batch");
        verify(notificationPreferenceService).meta();
        verify(notificationPreferenceService).preview(any());

        for (var builder : List.of(
                put("/notification-preferences"),
                put("/notification-preferences/batch"),
                patch("/notification-preferences/system"),
                delete("/notification-preferences/5"),
                get("/notification-preferences/user/7"),
                get("/notification-preferences/batch/7"),
                post("/notification-preferences/send"),
                post("/notification-preferences/test-send")
        )) {
            mockMvc.perform(builder.contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(result -> assertTrue(result.getResponse().getStatus() >= 400));
        }
    }

    @Test
    void shouldReturnForbiddenWhenTenantBoundaryFailsClosedInService() throws Exception {
        when(notificationPreferenceService.list()).thenThrow(new AccessDeniedException("Missing tenant identifier"));

        mockMvc.perform(get("/notification-preferences"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    private NotificationPreferenceDTO preference() {
        return NotificationPreferenceDTO.builder()
                .id(7L)
                .tenantId("tenant-a")
                .category("system")
                .categoryLabel("系统")
                .inApp(1)
                .email(0)
                .missingPreference(false)
                .tenantScoped(true)
                .readonlyBoundary("只读通知偏好目录")
                .build();
    }

    private NotificationPreferenceMetaDTO meta() {
        return NotificationPreferenceMetaDTO.builder()
                .categories(List.of(NotificationPreferenceMetaDTO.Option.builder().value("system").label("系统").build()))
                .noPersistencePreview(true)
                .runtimeEffect(false)
                .tenantScoped(true)
                .build();
    }

    private NotificationPreferencePreviewRespDTO preview() {
        return NotificationPreferencePreviewRespDTO.builder()
                .wouldReceive(true)
                .inAppEnabled(true)
                .emailEnabled(false)
                .quietWindowMatched(false)
                .missingPreferences(List.of())
                .rejectedInputs(List.of())
                .tenantScoped(true)
                .noPersistence(true)
                .runtimeEffect(false)
                .readonlyBoundary("只读通知偏好目录")
                .build();
    }
}
