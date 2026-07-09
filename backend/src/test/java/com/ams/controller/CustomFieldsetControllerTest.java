package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.CustomFieldDTO;
import com.ams.dto.CustomFieldsetDTO;
import com.ams.dto.CustomFieldsetMetaDTO;
import com.ams.dto.CustomFieldsetPreviewRespDTO;
import com.ams.service.CustomFieldsetService;
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
class CustomFieldsetControllerTest {

    @Mock
    private CustomFieldsetService customFieldsetService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new CustomFieldsetController(customFieldsetService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void shouldExposeOnlyReadCatalogFieldsMetaAndPreviewRoutes() throws Exception {
        when(customFieldsetService.list(any())).thenReturn(page());
        when(customFieldsetService.all()).thenReturn(List.of(fieldset()));
        when(customFieldsetService.detail(3L)).thenReturn(fieldset());
        when(customFieldsetService.fields(3L)).thenReturn(List.of(field()));
        when(customFieldsetService.byCategory(12L)).thenReturn(fieldset());
        when(customFieldsetService.meta()).thenReturn(meta());
        when(customFieldsetService.preview(any())).thenReturn(preview());

        mockMvc.perform(get("/system/custom-fieldsets?page=1&pageSize=20&keyword=IT"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[0].name").value("IT 设备字段集"))
                .andExpect(jsonPath("$.data.tenantScoped").value(true));

        mockMvc.perform(get("/system/custom-fieldsets/all"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].name").value("IT 设备字段集"));

        mockMvc.perform(get("/system/custom-fieldsets/3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.categoryId").value(12));

        mockMvc.perform(get("/system/custom-fieldsets/3/fields"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].fieldName").value("warranty_expiry"));

        mockMvc.perform(get("/system/custom-fieldsets/by-category/12"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("IT 设备字段集"));

        mockMvc.perform(get("/system/custom-fieldsets/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.noPersistencePreview").value(true))
                .andExpect(jsonPath("$.data.runtimeEffect").value(false));

        mockMvc.perform(post("/system/custom-fieldsets/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fieldsetId\":3,\"fieldIds\":[7,8],\"categoryId\":12}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.noPersistence").value(true))
                .andExpect(jsonPath("$.data.runtimeEffect").value(false));

        verify(customFieldsetService).list(any());
        verify(customFieldsetService).all();
        verify(customFieldsetService).detail(3L);
        verify(customFieldsetService).fields(3L);
        verify(customFieldsetService).byCategory(12L);
        verify(customFieldsetService).meta();
        verify(customFieldsetService).preview(any());

        for (ResultActions action : List.of(
                mockMvc.perform(post("/system/custom-fieldsets").contentType(MediaType.APPLICATION_JSON).content("{}")),
                mockMvc.perform(put("/system/custom-fieldsets/3").contentType(MediaType.APPLICATION_JSON).content("{}")),
                mockMvc.perform(patch("/system/custom-fieldsets/3").contentType(MediaType.APPLICATION_JSON).content("{}")),
                mockMvc.perform(delete("/system/custom-fieldsets/3")),
                mockMvc.perform(post("/system/custom-fieldsets/3/fields").contentType(MediaType.APPLICATION_JSON).content("{}")),
                mockMvc.perform(post("/system/custom-fieldsets/assign-category").contentType(MediaType.APPLICATION_JSON).content("{}")),
                mockMvc.perform(get("/assets/99/custom-fields"))
        )) {
            action.andExpect(result -> assertTrue(result.getResponse().getStatus() >= 400));
        }
    }

    @Test
    void shouldReturnForbiddenWhenServiceFailsClosedOnTenant() throws Exception {
        when(customFieldsetService.list(any())).thenThrow(new AccessDeniedException("Missing tenant identifier"));

        mockMvc.perform(get("/system/custom-fieldsets"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    private CustomFieldsetDTO.PageResult page() {
        return CustomFieldsetDTO.PageResult.builder()
                .records(List.of(fieldset()))
                .total(1)
                .size(20)
                .current(1)
                .pages(1)
                .tenantScoped(true)
                .readonlyBoundary("字段集只读 catalog")
                .build();
    }

    private CustomFieldsetDTO fieldset() {
        return CustomFieldsetDTO.builder()
                .id(3L)
                .tenantId("tenant-a")
                .name("IT 设备字段集")
                .description("IT 设备扩展字段")
                .categoryId(12L)
                .status(1)
                .fieldCount(2)
                .tenantScoped(true)
                .noPersistence(true)
                .runtimeEffect(false)
                .build();
    }

    private CustomFieldDTO field() {
        return CustomFieldDTO.builder()
                .id(7L)
                .tenantId("tenant-a")
                .fieldName("warranty_expiry")
                .fieldLabel("保修到期")
                .fieldType("DATE")
                .status(1)
                .tenantScoped(true)
                .build();
    }

    private CustomFieldsetMetaDTO meta() {
        return CustomFieldsetMetaDTO.builder()
                .noPersistencePreview(true)
                .tenantScoped(true)
                .runtimeEffect(false)
                .build();
    }

    private CustomFieldsetPreviewRespDTO preview() {
        return CustomFieldsetPreviewRespDTO.builder()
                .valid(true)
                .missingFields(List.of())
                .rejectedFields(List.of())
                .usedFields(List.of())
                .wouldBindCategory(true)
                .tenantScoped(true)
                .noPersistence(true)
                .runtimeEffect(false)
                .errors(List.of())
                .build();
    }
}
