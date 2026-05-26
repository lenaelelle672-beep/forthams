package com.ams.controller;

import com.ams.dto.DashboardStatsDTO;
import com.ams.service.DashboardService;
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

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "server.servlet.context-path=/api")
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("BigScreen Controller Tests")
class BigScreenControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DashboardService dashboardService;

    @Test
    @DisplayName("Should return global bigscreen stats")
    void getStats() throws Exception {
        DashboardStatsDTO stats = new DashboardStatsDTO();
        stats.setTotalAssets(100L);
        stats.setInUseAssets(60L);
        stats.setUtilizationRate(60D);
        stats.setTotalValue(new BigDecimal("1000000"));
        stats.setNetValue(new BigDecimal("800000"));
        stats.setPendingApprovals(5L);
        stats.setPendingWorkOrders(7L);
        stats.setInventoryProgress(50D);
        stats.setCriticalAlerts(2L);
        when(dashboardService.getGlobalStats()).thenReturn(stats);

        mockMvc.perform(get("/api/bigscreen/stats")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.totalAssets").value(100))
            .andExpect(jsonPath("$.data.utilizationRate").value(60D))
            .andExpect(jsonPath("$.data.pendingWorkOrders").value(7))
            .andExpect(jsonPath("$.data.inventoryProgress").value(50D))
            .andExpect(jsonPath("$.data.criticalAlerts").value(2));

        verify(dashboardService).getGlobalStats();
    }
}
