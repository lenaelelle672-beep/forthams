package com.ams.controller;

import com.ams.service.DepreciationService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "server.servlet.context-path=/api")
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Depreciation controller tests")
class DepreciationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DepreciationService depreciationService;

    @Test
    @DisplayName("Should expose depreciation schedules route")
    void schedulesReturnsPagedRows() throws Exception {
        DepreciationService.DepreciationScheduleItem row = new DepreciationService.DepreciationScheduleItem(
                1L,
                1L,
                "A-001",
                "资产一",
                "2026-05",
                new BigDecimal("10.00"),
                new BigDecimal("20.00"),
                new BigDecimal("980.00"),
                new BigDecimal("0.12"),
                "IDLE",
                "straight_line");
        when(depreciationService.getSchedules(eq("A-001"), eq("2026-05"), eq(1), eq(10)))
                .thenReturn(new DepreciationService.DepreciationSchedulePage(List.of(row), 1, 1, 10));

        mockMvc.perform(get("/api/depreciation/schedules")
                        .contextPath("/api")
                        .param("assetNo", "A-001")
                        .param("period", "2026-05"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.data[0].assetNo").value("A-001"));

        verify(depreciationService).getSchedules("A-001", "2026-05", 1, 10);
    }

    @Test
    @DisplayName("Should expose depreciation calculate route")
    void calculateReturnsProcessedCount() throws Exception {
        when(depreciationService.calculate(eq(List.of(1L, 2L))))
                .thenReturn(new DepreciationService.BatchCalculateResponse(2, "折旧计算完成"));

        mockMvc.perform(post("/api/depreciation/calculate")
                        .contextPath("/api")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetIds\":[1,2]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.processedCount").value(2));

        verify(depreciationService).calculate(List.of(1L, 2L));
    }
}
