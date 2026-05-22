package com.ams.controller;

import com.ams.dto.StatsResponse;
import com.ams.service.StatsService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Stats Controller Tests")
class StatsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private StatsService statsService;

    @Test
    @DisplayName("Should return stats overview")
    void testGetOverview() throws Exception {
        StatsResponse response = new StatsResponse(100L, 500L, 15L, "2026-05-22T10:00:00Z");

        when(statsService.getOverview()).thenReturn(response);

        mockMvc.perform(get("/stats/overview")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.totalUsers").value(100))
            .andExpect(jsonPath("$.data.totalAssets").value(500));

        verify(statsService).getOverview();
    }

    @Test
    @DisplayName("Should return zeroed stats when service returns zeros")
    void testGetOverviewZeroed() throws Exception {
        StatsResponse response = StatsResponse.zeroed();

        when(statsService.getOverview()).thenReturn(response);

        mockMvc.perform(get("/stats/overview")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.totalUsers").value(0))
            .andExpect(jsonPath("$.data.totalAssets").value(0))
            .andExpect(jsonPath("$.data.pendingActions").value(0));

        verify(statsService).getOverview();
    }

    @Test
    @DisplayName("Should return error when service throws exception")
    void testGetOverviewError() throws Exception {
        when(statsService.getOverview()).thenThrow(new RuntimeException("Database error"));

        mockMvc.perform(get("/stats/overview")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(500));

        verify(statsService).getOverview();
    }
}
