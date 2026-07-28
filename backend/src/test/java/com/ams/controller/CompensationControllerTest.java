package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.CompensationCreateDTO;
import com.ams.entity.AssetCompensation;
import com.ams.service.CompensationService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class CompensationControllerTest {

    @Mock
    private CompensationService compensationService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new CompensationController(compensationService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listShouldReturnPaginatedCompensations() throws Exception {
        when(compensationService.queryCompensations(eq(1), eq(10), isNull(), isNull())).thenReturn(page());

        mockMvc.perform(get("/compensation/list?page=1&pageSize=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.records[0].compensationNo").value("CMP-20260728-0001"))
                .andExpect(jsonPath("$.data.records[0].compensationType").value("DAMAGE"))
                .andExpect(jsonPath("$.data.total").value(1));

        verify(compensationService).queryCompensations(eq(1), eq(10), isNull(), isNull());
    }

    @Test
    void getByIdShouldReturnCompensationDetail() throws Exception {
        when(compensationService.getById(7L)).thenReturn(compensation(7L));

        mockMvc.perform(get("/compensation/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(7))
                .andExpect(jsonPath("$.data.compensationNo").value("CMP-20260728-0001"))
                .andExpect(jsonPath("$.data.compensationType").value("DAMAGE"));

        verify(compensationService).getById(7L);
    }

    @Test
    void createShouldSucceedWithValidPayload() throws Exception {
        when(compensationService.createCompensation(any(CompensationCreateDTO.class))).thenReturn(compensation(7L));

        mockMvc.perform(post("/compensation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetId\":1,\"compensationType\":\"DAMAGE\",\"compensationAmount\":1500.00,\"responsibleUserId\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(7))
                .andExpect(jsonPath("$.data.compensationNo").value("CMP-20260728-0001"));

        verify(compensationService).createCompensation(any(CompensationCreateDTO.class));
    }

    private Page<AssetCompensation> page() {
        Page<AssetCompensation> page = new Page<>(1, 10);
        page.setRecords(List.of(compensation(7L)));
        page.setTotal(1);
        return page;
    }

    private AssetCompensation compensation(Long id) {
        AssetCompensation compensation = new AssetCompensation();
        compensation.setId(id);
        compensation.setCompensationNo("CMP-20260728-0001");
        compensation.setAssetId(1L);
        compensation.setCompensationType("DAMAGE");
        compensation.setCompensationAmount(new BigDecimal("1500.00"));
        compensation.setResponsibleUserId(2L);
        compensation.setStatus("PENDING");
        return compensation;
    }
}
