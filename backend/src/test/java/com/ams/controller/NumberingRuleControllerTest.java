package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.NumberingRuleDTO;
import com.ams.dto.NumberingRuleMetaDTO;
import com.ams.dto.NumberingRulePreviewRespDTO;
import com.ams.service.NumberingRuleService;
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
class NumberingRuleControllerTest {

    @Mock
    private NumberingRuleService numberingRuleService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new NumberingRuleController(numberingRuleService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void shouldExposeOnlyListDetailMetaAndPreviewRoutes() throws Exception {
        when(numberingRuleService.list()).thenReturn(List.of(rule()));
        when(numberingRuleService.get("numbering.rule.asset")).thenReturn(rule());
        when(numberingRuleService.meta()).thenReturn(meta());
        when(numberingRuleService.preview(any())).thenReturn(preview());

        mockMvc.perform(get("/numbering-rules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].ruleKey").value("numbering.rule.asset"))
                .andExpect(jsonPath("$.data[0].tenantScoped").value(true));

        mockMvc.perform(get("/numbering-rules/numbering.rule.asset"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.template").value("AUTO-{YYYYMMDD}-{SEQ}"));

        mockMvc.perform(get("/numbering-rules/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.previewPolicy.noPersistence").value(true))
                .andExpect(jsonPath("$.data.previewPolicy.noSequenceReserved").value(true))
                .andExpect(jsonPath("$.data.previewPolicy.runtimeEffect").value(false));

        mockMvc.perform(post("/numbering-rules/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"ruleKey\":\"numbering.rule.asset\",\"sampleAt\":\"2026-07-08T09:10:11\",\"sampleSequence\":\"009\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.previewValue").value("AUTO-20260708-009"))
                .andExpect(jsonPath("$.data.noPersistence").value(true))
                .andExpect(jsonPath("$.data.noSequenceReserved").value(true))
                .andExpect(jsonPath("$.data.runtimeEffect").value(false))
                .andExpect(jsonPath("$.data.cacheRefreshed").value(false))
                .andExpect(jsonPath("$.data.sequenceAllocated").value(false))
                .andExpect(jsonPath("$.data.persistent").value(false));

        verify(numberingRuleService).list();
        verify(numberingRuleService).get("numbering.rule.asset");
        verify(numberingRuleService).meta();
        verify(numberingRuleService).preview(any());

        for (var builder : List.of(
                post("/numbering-rules"),
                put("/numbering-rules/numbering.rule.asset"),
                patch("/numbering-rules/numbering.rule.asset"),
                delete("/numbering-rules/numbering.rule.asset"),
                post("/numbering-rules/allocate"),
                post("/numbering-rules/reserve")
        )) {
            mockMvc.perform(builder.contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(result -> assertNotEquals(200, result.getResponse().getStatus()));
        }
    }

    @Test
    void shouldReturnForbiddenWhenTenantBoundaryFailsClosedInService() throws Exception {
        when(numberingRuleService.list()).thenThrow(new AccessDeniedException("Missing tenant identifier"));

        mockMvc.perform(get("/numbering-rules"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    private NumberingRuleDTO rule() {
        return NumberingRuleDTO.builder()
                .tenantId("tenant-a")
                .ruleKey("numbering.rule.asset")
                .name("资产编号规则")
                .template("AUTO-{YYYYMMDD}-{SEQ}")
                .source("system_config")
                .authority("system_config:numbering.rule.*")
                .tenantScoped(true)
                .readOnly(true)
                .readonlyBoundary("只读编号规则目录")
                .variables(List.of("{YYYYMMDD}", "{SEQ}"))
                .build();
    }

    private NumberingRuleMetaDTO meta() {
        return NumberingRuleMetaDTO.builder()
                .previewPolicy(NumberingRuleMetaDTO.PreviewPolicy.builder()
                        .noPersistence(true)
                        .noSequenceReserved(true)
                        .runtimeEffect(false)
                        .cacheRefreshed(false)
                        .sequenceAllocated(false)
                        .persistent(false)
                        .build())
                .tenantScoped(true)
                .readOnly(true)
                .build();
    }

    private NumberingRulePreviewRespDTO preview() {
        return NumberingRulePreviewRespDTO.builder()
                .ruleKey("numbering.rule.asset")
                .template("AUTO-{YYYYMMDD}-{SEQ}")
                .previewValue("AUTO-20260708-009")
                .usedVariables(List.of("{YYYYMMDD}", "{SEQ}"))
                .missingVariables(List.of())
                .rejectedVariables(List.of())
                .authority("system_config:numbering.rule.*")
                .warnings(List.of("不预留序号"))
                .tenantScoped(true)
                .noPersistence(true)
                .noSequenceReserved(true)
                .runtimeEffect(false)
                .cacheRefreshed(false)
                .sequenceAllocated(false)
                .persistent(false)
                .readonlyBoundary("只读编号规则目录")
                .build();
    }
}
