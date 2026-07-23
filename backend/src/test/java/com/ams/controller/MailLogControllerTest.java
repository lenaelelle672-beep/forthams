package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.MailLogDTO;
import com.ams.dto.MailLogDetailDTO;
import com.ams.dto.MailLogMetaDTO;
import com.ams.service.MailLogService;
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
class MailLogControllerTest {

    @Mock
    private MailLogService mailLogService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new MailLogController(mailLogService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void shouldExposeOnlyReadOnlyRedactedMailLogRoutes() throws Exception {
        when(mailLogService.list(any())).thenReturn(page());
        when(mailLogService.detail(7L)).thenReturn(detail());
        when(mailLogService.getByBiz("asset", 18L)).thenReturn(List.of(log()));
        when(mailLogService.meta()).thenReturn(meta());

        mockMvc.perform(get("/mail-logs/list?page=1&pageSize=20&templateCode=ASSET_NOTIFY&sendStatus=FAILED&bizType=asset&bizId=18"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[0].maskedMailTo").value("o***@e***"))
                .andExpect(jsonPath("$.data.records[0].redacted").value(true))
                .andExpect(jsonPath("$.data.readOnly").value(true));

        mockMvc.perform(get("/mail-logs/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.maskedSubject").value("主题已脱敏，长度=4"))
                .andExpect(jsonPath("$.data.redactionPolicy[0]").value("收件人、抄送、密送与发件人只返回掩码"));

        mockMvc.perform(get("/mail-logs/biz?bizType=asset&bizId=18"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].diagnosticSummary").value("状态=FAILED；重试=1/3；错误详情已脱敏"));

        mockMvc.perform(get("/mail-logs/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.collectionGuaranteed").value(false))
                .andExpect(jsonPath("$.data.redacted").value(true));

        verify(mailLogService).list(any());
        verify(mailLogService).detail(7L);
        verify(mailLogService).getByBiz("asset", 18L);
        verify(mailLogService).meta();

        for (var builder : List.of(
                post("/mail-logs/7/retry"),
                post("/mail-logs/7/resend"),
                post("/mail-logs/export"),
                get("/mail-logs/export"),
                get("/mail-logs/download"),
                post("/mail-logs/send"),
                post("/mail-logs/test-send"),
                put("/mail-logs/7"),
                patch("/mail-logs/7"),
                delete("/mail-logs/7")
        )) {
            mockMvc.perform(builder.contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(result -> assertTrue(result.getResponse().getStatus() >= 400));
        }
    }

    @Test
    void shouldReturnForbiddenWhenTenantBoundaryFailsClosedInService() throws Exception {
        when(mailLogService.list(any())).thenThrow(new AccessDeniedException("Missing tenant identifier"));

        mockMvc.perform(get("/mail-logs/list"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    private MailLogDTO.PageResult page() {
        return MailLogDTO.PageResult.builder()
                .records(List.of(log()))
                .total(1)
                .size(20)
                .current(1)
                .pages(1)
                .redacted(true)
                .tenantScoped(true)
                .readOnly(true)
                .readonlyBoundary("邮件日志只读 catalog")
                .build();
    }

    private MailLogDTO log() {
        return MailLogDTO.builder()
                .id(7L)
                .tenantId("tenant-a")
                .templateCode("ASSET_NOTIFY")
                .maskedMailTo("o***@e***")
                .maskedSubject("主题已脱敏，长度=4")
                .sendStatus("FAILED")
                .diagnosticSummary("状态=FAILED；重试=1/3；错误详情已脱敏")
                .retryCount(1)
                .maxRetry(3)
                .bizType("asset")
                .bizId(18L)
                .redacted(true)
                .tenantScoped(true)
                .readOnly(true)
                .build();
    }

    private MailLogDetailDTO detail() {
        return MailLogDetailDTO.builder()
                .id(7L)
                .tenantId("tenant-a")
                .templateCode("ASSET_NOTIFY")
                .maskedMailTo("o***@e***")
                .maskedSubject("主题已脱敏，长度=4")
                .sendStatus("FAILED")
                .diagnosticSummary("状态=FAILED；重试=1/3；错误详情已脱敏")
                .redacted(true)
                .tenantScoped(true)
                .readOnly(true)
                .redactionPolicy(List.of("收件人、抄送、密送与发件人只返回掩码"))
                .build();
    }

    private MailLogMetaDTO meta() {
        return MailLogMetaDTO.builder()
                .sendStatuses(List.of(MailLogMetaDTO.Option.builder().value("FAILED").label("发送失败").build()))
                .redacted(true)
                .tenantScoped(true)
                .readOnly(true)
                .collectionGuaranteed(false)
                .build();
    }
}
