package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.CustomFieldDTO;
import com.ams.dto.CustomFieldMetaDTO;
import com.ams.dto.CustomFieldPreviewRespDTO;
import com.ams.service.CustomFieldService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
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
class CustomFieldControllerTest {

    @Mock
    private CustomFieldService customFieldService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new CustomFieldController(customFieldService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void shouldExposeOnlyDefinitionCatalogMetaAndPreviewRoutes() throws Exception {
        when(customFieldService.list(any())).thenReturn(page());
        when(customFieldService.all()).thenReturn(List.of(field()));
        when(customFieldService.detail(7L)).thenReturn(field());
        when(customFieldService.meta()).thenReturn(meta());
        when(customFieldService.preview(any())).thenReturn(preview());

        mockMvc.perform(get("/system/custom-fields?page=1&pageSize=20&keyword=保修"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[0].fieldName").value("warranty_expiry"))
                .andExpect(jsonPath("$.data.tenantScoped").value(true));

        mockMvc.perform(get("/system/custom-fields/all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].fieldLabel").value("保修到期"));

        mockMvc.perform(get("/system/custom-fields/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fieldType").value("DATE"));

        mockMvc.perform(get("/system/custom-fields/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.noPersistencePreview").value(true))
                .andExpect(jsonPath("$.data.runtimeEffect").value(false));

        mockMvc.perform(post("/system/custom-fields/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"values\":{\"warranty_expiry\":\"2026-12-31\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.noPersistence").value(true))
                .andExpect(jsonPath("$.data.runtimeEffect").value(false));

        verify(customFieldService).list(any());
        verify(customFieldService).all();
        verify(customFieldService).detail(7L);
        verify(customFieldService).meta();
        verify(customFieldService).preview(any());

        for (ResultActions action : List.of(
                mockMvc.perform(post("/system/custom-fields").contentType(MediaType.APPLICATION_JSON).content("{}")),
                mockMvc.perform(put("/system/custom-fields/7").contentType(MediaType.APPLICATION_JSON).content("{}")),
                mockMvc.perform(patch("/system/custom-fields/7").contentType(MediaType.APPLICATION_JSON).content("{}")),
                mockMvc.perform(delete("/system/custom-fields/7")),
                mockMvc.perform(get("/system/custom-fieldsets/all")),
                mockMvc.perform(get("/assets/99/custom-fields"))
        )) {
            action.andExpect(result -> assertTrue(result.getResponse().getStatus() >= 400));
        }
    }

    @Test
    void shouldReturnForbiddenWhenServiceFailsClosedOnTenant() throws Exception {
        when(customFieldService.list(any())).thenThrow(new AccessDeniedException("Missing tenant identifier"));

        mockMvc.perform(get("/system/custom-fields"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    private CustomFieldDTO.PageResult page() {
        return CustomFieldDTO.PageResult.builder()
                .records(List.of(field()))
                .total(1)
                .size(20)
                .current(1)
                .pages(1)
                .tenantScoped(true)
                .readonlyBoundary("自定义字段定义只读 catalog")
                .build();
    }

    private CustomFieldDTO field() {
        return CustomFieldDTO.builder()
                .id(7L)
                .tenantId("tenant-a")
                .fieldName("warranty_expiry")
                .fieldLabel("保修到期")
                .fieldType("DATE")
                .fieldOrder(10)
                .required(1)
                .encrypted(0)
                .status(1)
                .tenantScoped(true)
                .build();
    }

    private CustomFieldMetaDTO meta() {
        return CustomFieldMetaDTO.builder()
                .noPersistencePreview(true)
                .tenantScoped(true)
                .runtimeEffect(false)
                .build();
    }

    private CustomFieldPreviewRespDTO preview() {
        return CustomFieldPreviewRespDTO.builder()
                .valid(true)
                .missing(List.of())
                .rejected(List.of())
                .errors(List.of())
                .usedFields(List.of())
                .tenantScoped(true)
                .noPersistence(true)
                .runtimeEffect(false)
                .build();
    }
}
