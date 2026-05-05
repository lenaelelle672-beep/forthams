package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.XxxCreateDTO;
import com.ams.dto.XxxUpdateDTO;
import com.ams.entity.Xxx;
import com.ams.service.XxxService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(XxxController.class)
@ActiveProfiles("test")
@DisplayName("Xxx Controller Tests")
class XxxControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private XxxService xxxService;

    @Test
    @DisplayName("Should return list when querying with valid parameters")
    void testQueryList() throws Exception {
        Page<Xxx> mockPage = new Page<>(1, 10);
        when(xxxService.queryXxx(any(), any())).thenReturn(mockPage);

        mockMvc.perform(get("/api/xxx/list")
                .param("page", "1")
                .param("pageSize", "10")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(xxxService).queryXxx(any(), any());
    }

    @Test
    @DisplayName("Should return item when getting by valid ID")
    void testGetById() throws Exception {
        Xxx mockXxx = new Xxx();
        when(xxxService.getById(1L)).thenReturn(mockXxx);

        mockMvc.perform(get("/api/xxx/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(xxxService).getById(1L);
    }

    @Test
    @DisplayName("Should create successfully with valid data")
    void testCreate() throws Exception {
        XxxCreateDTO createDTO = new XxxCreateDTO();
        Xxx mockResult = new Xxx();

        when(xxxService.create(any(XxxCreateDTO.class))).thenReturn(mockResult);

        mockMvc.perform(post("/api/xxx")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createDTO)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(xxxService).create(any(XxxCreateDTO.class));
    }

    @Test
    @DisplayName("Should update successfully with valid data")
    void testUpdate() throws Exception {
        XxxUpdateDTO updateDTO = new XxxUpdateDTO();
        Xxx mockResult = new Xxx();

        when(xxxService.update(eq(1L), any(XxxUpdateDTO.class))).thenReturn(mockResult);

        mockMvc.perform(put("/api/xxx/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateDTO)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(xxxService).update(eq(1L), any(XxxUpdateDTO.class));
    }

    @Test
    @DisplayName("Should delete successfully with valid ID")
    void testDelete() throws Exception {
        mockMvc.perform(delete("/api/xxx/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(xxxService).delete(1L);
    }

    @Test
    @DisplayName("Should return 400 when creating with invalid data")
    void testCreateWithInvalidData() throws Exception {
        XxxCreateDTO invalidDTO = new XxxCreateDTO();

        mockMvc.perform(post("/api/xxx")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidDTO)))
            .andExpect(status().isBadRequest());
    }
}
