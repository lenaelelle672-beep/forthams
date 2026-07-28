package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.common.Result;
import com.ams.dto.AssetValueTrendDTO;
import com.ams.dto.DashboardStatsDTO;
import com.ams.dto.DeptAssetDistributionDTO;
import com.ams.service.DashboardService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class DashboardControllerTest {

    @Mock
    private DashboardService dashboardService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new DashboardController(dashboardService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void getStatsShouldReturnDashboardStats() throws Exception {
        DashboardStatsDTO stats = new DashboardStatsDTO();
        stats.setTotalAssets(100L);
        stats.setTotalValue(new BigDecimal("500000.00"));
        when(dashboardService.getStats()).thenReturn(stats);

        mockMvc.perform(get("/dashboard/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.totalAssets").value(100));
    }

    @Test
    void getValueTrendsShouldReturnTrendList() throws Exception {
        AssetValueTrendDTO trend = new AssetValueTrendDTO();
        when(dashboardService.getValueTrends(7)).thenReturn(List.of(trend));

        mockMvc.perform(get("/dashboard/trends").param("days", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    void getDeptDistributionShouldReturnList() throws Exception {
        when(dashboardService.getDeptDistribution()).thenReturn(List.of());

        mockMvc.perform(get("/dashboard/dept-distribution"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    void getMaintenanceStatsShouldReturnMap() throws Exception {
        when(dashboardService.getMaintenanceStats()).thenReturn(Map.of("totalMaintenanceCount", 5L));

        mockMvc.perform(get("/dashboard/maintenance-stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    void getPendingApprovalsShouldReturnCount() throws Exception {
        when(dashboardService.getPendingApprovals()).thenReturn(3L);

        mockMvc.perform(get("/dashboard/pending-approvals"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").value(3));
    }
}
