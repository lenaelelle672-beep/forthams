package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.MailGatewayDTO;
import com.ams.dto.MailGatewayMetaDTO;
import com.ams.dto.MailGatewayPreviewRespDTO;
import com.ams.service.MailGatewayService;
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
class MailGatewayControllerTest {

    @Mock
    private MailGatewayService mailGatewayService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new MailGatewayController(mailGatewayService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void shouldExposeOnlyListDetailMetaAndPreviewRoutes() throws Exception {
        when(mailGatewayService.list(any())).thenReturn(page());
        when(mailGatewayService.detail(8L)).thenReturn(gateway());
        when(mailGatewayService.meta()).thenReturn(meta());
        when(mailGatewayService.preview(any())).thenReturn(preview());

        mockMvc.perform(get("/system/mail-gateways?page=1&pageSize=20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[0].gatewayCode").value("smtp-main"))
                .andExpect(jsonPath("$.data.records[0].hostMasked").value("smtp.***.corp"))
                .andExpect(jsonPath("$.data.tenantScoped").value(true))
                .andExpect(jsonPath("$.data.readOnly").value(true));

        mockMvc.perform(get("/system/mail-gateways/8"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.gatewayName").value("主邮件网关"))
                .andExpect(jsonPath("$.data.authConfigured").value(true));

        mockMvc.perform(get("/system/mail-gateways/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.previewPolicy.noPersistence").value(true))
                .andExpect(jsonPath("$.data.previewPolicy.noSend").value(true))
                .andExpect(jsonPath("$.data.previewPolicy.noNetwork").value(true))
                .andExpect(jsonPath("$.data.previewPolicy.smtpConnect").value(false));

        mockMvc.perform(post("/system/mail-gateways/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"gatewayCode\":\"smtp-main\",\"hostMasked\":\"smtp.***.corp\",\"port\":587,\"tlsMode\":\"STARTTLS\",\"password\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.noPersistence").value(true))
                .andExpect(jsonPath("$.data.noSend").value(true))
                .andExpect(jsonPath("$.data.noNetwork").value(true))
                .andExpect(jsonPath("$.data.runtimeEffect").value(false))
                .andExpect(jsonPath("$.data.cacheRefreshed").value(false))
                .andExpect(jsonPath("$.data.credentialExposed").value(false))
                .andExpect(jsonPath("$.data.smtpConnect").value(false))
                .andExpect(jsonPath("$.data.javaMailSenderUsed").value(false))
                .andExpect(jsonPath("$.data.mailSenderProviderUsed").value(false));

        verify(mailGatewayService).list(any());
        verify(mailGatewayService).detail(8L);
        verify(mailGatewayService).meta();
        verify(mailGatewayService).preview(any());

        for (var builder : List.of(
                post("/system/mail-gateways"),
                put("/system/mail-gateways/8"),
                patch("/system/mail-gateways/8"),
                delete("/system/mail-gateways/8"),
                post("/system/mail-gateways/8/test"),
                post("/system/mail-gateways/8/send")
        )) {
            mockMvc.perform(builder.contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(result -> assertNotEquals(200, result.getResponse().getStatus()));
        }
    }

    @Test
    void shouldReturnForbiddenWhenTenantBoundaryFailsClosedInService() throws Exception {
        when(mailGatewayService.list(any())).thenThrow(new AccessDeniedException("Missing tenant identifier"));

        mockMvc.perform(get("/system/mail-gateways"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    private MailGatewayDTO.PageResult page() {
        return MailGatewayDTO.PageResult.builder()
                .records(List.of(gateway()))
                .total(1)
                .page(1)
                .pageSize(20)
                .pages(1)
                .tenantScoped(true)
                .readOnly(true)
                .readonlyBoundary("只读邮件网关目录")
                .build();
    }

    private MailGatewayDTO gateway() {
        return MailGatewayDTO.builder()
                .id(8L)
                .gatewayCode("smtp-main")
                .gatewayName("主邮件网关")
                .hostMasked("smtp.***.corp")
                .port(587)
                .tlsMode("STARTTLS")
                .authConfigured(true)
                .senderMasked("n***@c***")
                .priority(10)
                .enabled(true)
                .lastTestStatus("SUCCESS")
                .tenantScoped(true)
                .readOnly(true)
                .readonlyBoundary("只读邮件网关目录")
                .build();
    }

    private MailGatewayMetaDTO meta() {
        return MailGatewayMetaDTO.builder()
                .previewPolicy(MailGatewayMetaDTO.PreviewPolicy.builder()
                        .noPersistence(true)
                        .noSend(true)
                        .noNetwork(true)
                        .runtimeEffect(false)
                        .cacheRefreshed(false)
                        .credentialExposed(false)
                        .smtpConnect(false)
                        .javaMailSenderUsed(false)
                        .mailSenderProviderUsed(false)
                        .build())
                .tenantScoped(true)
                .readOnly(true)
                .build();
    }

    private MailGatewayPreviewRespDTO preview() {
        return MailGatewayPreviewRespDTO.builder()
                .previewAccepted(false)
                .configured(true)
                .acceptedFields(List.of("hostMasked", "port", "tlsMode"))
                .rejectedInputs(List.of(MailGatewayPreviewRespDTO.RejectedInput.builder().field("password").reason("敏感输入被拒绝").build()))
                .warnings(List.of("dry-run preview only"))
                .tenantScoped(true)
                .readOnly(true)
                .noPersistence(true)
                .noSend(true)
                .noNetwork(true)
                .runtimeEffect(false)
                .cacheRefreshed(false)
                .credentialExposed(false)
                .smtpConnect(false)
                .javaMailSenderUsed(false)
                .mailSenderProviderUsed(false)
                .readonlyBoundary("只读邮件网关目录")
                .build();
    }
}
