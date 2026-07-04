package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.SystemFieldMappingPreviewResponse;
import com.ams.dto.SystemFieldMappingResponse;
import com.ams.service.SystemFieldMappingService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class SystemFieldMappingControllerTest {

    @Mock
    private SystemFieldMappingService fieldMappingService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new SystemFieldMappingController(fieldMappingService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listShouldExposeV3FieldMappingsEndpoint() throws Exception {
        when(fieldMappingService.list()).thenReturn(List.of(response()));

        mockMvc.perform(get("/system/field-mappings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].sourceField").value("name"));
    }

    @Test
    void createShouldUseDedicatedServiceAndBearerUser() throws Exception {
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(fieldMappingService.create(any())).thenReturn(response());

        mockMvc.perform(post("/system/field-mappings")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"interfaceId\":7,\"sourceField\":\"name\",\"targetField\":\"assetName\",\"transformExpression\":\"trim(value)\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.transformExpression").value("trim(value)"));

        verify(fieldMappingService).create(any());
    }

    @Test
    void updateStatusShouldRequireBearerToken() throws Exception {
        mockMvc.perform(put("/system/field-mappings/{id}/status", 3L)
                        .param("enabled", "false"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    void previewShouldExposePurePreviewEndpoint() throws Exception {
        SystemFieldMappingPreviewResponse preview = new SystemFieldMappingPreviewResponse();
        preview.setValid(true);
        preview.setTransformedValue("Laptop");
        when(fieldMappingService.preview(any())).thenReturn(preview);

        mockMvc.perform(post("/system/field-mappings/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sourceField\":\"name\",\"targetField\":\"assetName\",\"sampleValue\":\"  Laptop  \",\"transformExpression\":\"trim(value)\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.transformedValue").value("Laptop"));

        verify(fieldMappingService).preview(any());
    }

    private SystemFieldMappingResponse response() {
        SystemFieldMappingResponse response = new SystemFieldMappingResponse();
        response.setId(3L);
        response.setInterfaceId(7L);
        response.setSourceField("name");
        response.setTargetField("assetName");
        response.setTransformExpression("trim(value)");
        response.setEnabled(true);
        return response;
    }
}
