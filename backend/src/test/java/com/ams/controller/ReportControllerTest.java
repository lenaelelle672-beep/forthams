package com.ams.controller;

import com.ams.dto.CategoryReportDTO;
import com.ams.dto.ReportSummaryDTO;
import com.ams.service.ReportService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Report Controller Tests")
class ReportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ReportService reportService;

    @Test
    @DisplayName("Should return report summary")
    void testGetSummary() throws Exception {
        ReportSummaryDTO summary = ReportSummaryDTO.builder()
                .totalAssets(100)
                .activeAssets(80)
                .pendingApproval(5)
                .recentlyRetired(3)
                .build();

        when(reportService.getSummary()).thenReturn(summary);

        mockMvc.perform(get("/reports/summary")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.totalAssets").value(100))
            .andExpect(jsonPath("$.data.activeAssets").value(80));

        verify(reportService).getSummary();
    }

    @Test
    @DisplayName("Should return category report")
    void testGetByCategory() throws Exception {
        CategoryReportDTO cat1 = CategoryReportDTO.builder()
                .categoryName("Electronics")
                .assetCount(50)
                .totalValue(100000.0)
                .build();
        CategoryReportDTO cat2 = CategoryReportDTO.builder()
                .categoryName("Furniture")
                .assetCount(30)
                .totalValue(50000.0)
                .build();

        when(reportService.getByCategory()).thenReturn(Arrays.asList(cat1, cat2));

        mockMvc.perform(get("/reports/by-category")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data").isArray())
            .andExpect(jsonPath("$.data.length()").value(2));

        verify(reportService).getByCategory();
    }

    @Test
    @DisplayName("Should return empty category list when no data")
    void testGetByCategoryEmpty() throws Exception {
        when(reportService.getByCategory()).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/reports/by-category")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data").isArray())
            .andExpect(jsonPath("$.data.length()").value(0));

        verify(reportService).getByCategory();
    }
}
