package com.ams.controller;

import com.ams.dto.AssetValueTrendDTO;
import com.ams.dto.DashboardStatsDTO;
import com.ams.dto.DeptAssetDistributionDTO;
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
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "server.servlet.context-path=/api")
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Dashboard Controller Tests")
class DashboardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DashboardService dashboardService;

    @Test
    @DisplayName("Should return dashboard stats")
    void getStats() throws Exception {
        DashboardStatsDTO stats = new DashboardStatsDTO();
        stats.setTotalAssets(100L);
        stats.setInUseAssets(60L);
        stats.setIdleAssets(20L);
        stats.setMaintenanceAssets(10L);
        stats.setScrapAssets(10L);
        stats.setTotalValue(new BigDecimal("1000000"));
        stats.setNetValue(new BigDecimal("800000"));
        stats.setPendingApprovals(5L);
        when(dashboardService.getStats()).thenReturn(stats);

        mockMvc.perform(get("/api/dashboard/stats")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.totalAssets").value(100))
            .andExpect(jsonPath("$.data.inUseAssets").value(60))
            .andExpect(jsonPath("$.data.pendingApprovals").value(5));

        verify(dashboardService).getStats();
    }

    @Test
    @DisplayName("Should return value trends with default days")
    void getValueTrends() throws Exception {
        AssetValueTrendDTO trend = new AssetValueTrendDTO();
        trend.setDate(LocalDate.now());
        trend.setTotalValue(new BigDecimal("1000000"));
        trend.setNetValue(new BigDecimal("800000"));
        when(dashboardService.getValueTrends(anyInt())).thenReturn(List.of(trend));

        mockMvc.perform(get("/api/dashboard/trends")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data[0].totalValue").value(1000000));

        verify(dashboardService).getValueTrends(anyInt());
    }

    @Test
    @DisplayName("Should return dept distribution")
    void getDeptDistribution() throws Exception {
        DeptAssetDistributionDTO deptDist = new DeptAssetDistributionDTO();
        deptDist.setDeptId(1L);
        deptDist.setDeptName("技术部");
        deptDist.setAssetCount(50L);
        when(dashboardService.getDeptDistribution()).thenReturn(List.of(deptDist));

        mockMvc.perform(get("/api/dashboard/dept-distribution")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data[0].deptName").value("技术部"))
            .andExpect(jsonPath("$.data[0].assetCount").value(50));

        verify(dashboardService).getDeptDistribution();
    }

    @Test
    @DisplayName("Should return maintenance stats")
    void getMaintenanceStats() throws Exception {
        Map<String, Object> mockStats = Map.of(
            "totalMaintenanceCount", 10L,
            "avgMaintenanceCost", new BigDecimal("5000"),
            "monthlyMaintenanceCount", 3L
        );
        when(dashboardService.getMaintenanceStats()).thenReturn(mockStats);

        mockMvc.perform(get("/api/dashboard/maintenance-stats")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.totalMaintenanceCount").value(10));

        verify(dashboardService).getMaintenanceStats();
    }

    @Test
    @DisplayName("Should return pending approvals count")
    void getPendingApprovals() throws Exception {
        when(dashboardService.getPendingApprovals()).thenReturn(5L);

        mockMvc.perform(get("/api/dashboard/pending-approvals")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data").value(5));

        verify(dashboardService).getPendingApprovals();
    }
}
