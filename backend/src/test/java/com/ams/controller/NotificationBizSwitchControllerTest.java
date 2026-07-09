package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.NotificationBizSwitchDTO;
import com.ams.dto.NotificationBizSwitchMetaDTO;
import com.ams.dto.NotificationBizSwitchPreviewRespDTO;
import com.ams.service.NotificationBizSwitchService;
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

import static org.junit.jupiter.api.Assertions.assertNotEquals;
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
class NotificationBizSwitchControllerTest {

    @Mock
    private NotificationBizSwitchService notificationBizSwitchService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new NotificationBizSwitchController(notificationBizSwitchService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void shouldExposeOnlyReadonlyCatalogMetaAndPreviewRoutes() throws Exception {
        when(notificationBizSwitchService.list()).thenReturn(List.of(switchDto()));
        when(notificationBizSwitchService.getByBizType("maintenance")).thenReturn(List.of(switchDto()));
        when(notificationBizSwitchService.meta()).thenReturn(meta());
        when(notificationBizSwitchService.preview(any())).thenReturn(preview());

        mockMvc.perform(get("/notification-switches/list"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].bizType").value("maintenance"))
                .andExpect(jsonPath("$.data[0].tenantScoped").value(true));

        mockMvc.perform(get("/notification-switches/biz-type/maintenance"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].event").value("approved"));

        mockMvc.perform(get("/notification-switches/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.previewPolicy.noPersistence").value(true))
                .andExpect(jsonPath("$.data.previewPolicy.noSend").value(true))
                .andExpect(jsonPath("$.data.previewPolicy.workflowRuntimeEffect").value(false));

        mockMvc.perform(post("/notification-switches/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bizType\":\"maintenance\",\"event\":\"approved\",\"channelType\":\"IN_APP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.noPersistence").value(true))
                .andExpect(jsonPath("$.data.noSend").value(true))
                .andExpect(jsonPath("$.data.workflowRuntimeEffect").value(false));

        verify(notificationBizSwitchService).list();
        verify(notificationBizSwitchService).getByBizType("maintenance");
        verify(notificationBizSwitchService).meta();
        verify(notificationBizSwitchService).preview(any());

        for (var builder : List.of(
                put("/notification-switches/9"),
                patch("/notification-switches/9"),
                delete("/notification-switches/9"),
                post("/notification-switches"),
                post("/notification-switches/send"),
                post("/notification-switches/runtime")
        )) {
            mockMvc.perform(builder.contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(result -> assertNotEquals(200, result.getResponse().getStatus()));
        }
    }

    @Test
    void shouldReturnForbiddenWhenTenantBoundaryFailsClosedInService() throws Exception {
        when(notificationBizSwitchService.list()).thenThrow(new AccessDeniedException("Missing tenant identifier"));

        mockMvc.perform(get("/notification-switches/list"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    private NotificationBizSwitchDTO switchDto() {
        return NotificationBizSwitchDTO.builder()
                .id(9L)
                .tenantId("tenant-a")
                .bizType("maintenance")
                .event("approved")
                .channelType("IN_APP")
                .enabled(0)
                .templateCode("MAINT_APPROVED")
                .tenantScoped(true)
                .readonlyBoundary("只读流程通知开关目录")
                .build();
    }

    private NotificationBizSwitchMetaDTO meta() {
        return NotificationBizSwitchMetaDTO.builder()
                .previewPolicy(NotificationBizSwitchMetaDTO.PreviewPolicy.builder()
                        .tenantScoped(true)
                        .noPersistence(true)
                        .noSend(true)
                        .workflowRuntimeEffect(false)
                        .build())
                .tenantScoped(true)
                .build();
    }

    private NotificationBizSwitchPreviewRespDTO preview() {
        return NotificationBizSwitchPreviewRespDTO.builder()
                .wouldNotify(false)
                .blockedBySwitch(true)
                .matchedSwitches(List.of(switchDto()))
                .missingSwitches(List.of())
                .rejectedInputs(List.of())
                .tenantScoped(true)
                .noPersistence(true)
                .noSend(true)
                .workflowRuntimeEffect(false)
                .readonlyBoundary("只读流程通知开关目录")
                .build();
    }
}
