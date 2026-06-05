package com.ams.controller;

import com.ams.entity.EnergyConsumption;
import com.ams.entity.EnergyMeter;
import com.ams.service.EnergyService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Energy Controller Tests")
class EnergyControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private EnergyService energyService;

    @Nested @DisplayName("读数据端点")
    class ReadingEndpoints {
        @Test @DisplayName("GET /energy/meters — 获取读数列表")
        void getMeters() throws Exception {
            when(energyService.getReadings(any(),any(),any(),any())).thenReturn(List.of());
            mockMvc.perform(get("/energy/meters").param("assetId","1").param("meterType","ELECTRICITY")
                .param("startDate","2026-01-01").param("endDate","2026-06-01").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200)).andExpect(jsonPath("$.data").isArray());
        }
        @Test @DisplayName("GET /energy/meters — 无参数")
        void getMeters_noParams() throws Exception {
            when(energyService.getReadings(isNull(),isNull(),isNull(),isNull())).thenReturn(List.of());
            mockMvc.perform(get("/energy/meters").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        }
    }

    @Nested @DisplayName("写数据端点")
    class WriteEndpoints {
        @Test @DisplayName("POST /energy/meters — 添加读数")
        void addMeter() throws Exception {
            EnergyMeter meter = new EnergyMeter(); meter.setAssetId(1L); meter.setReadingValue(BigDecimal.valueOf(500));
            when(energyService.addReading(any(EnergyMeter.class))).thenReturn(meter);
            mockMvc.perform(post("/energy/meters").contentType(MediaType.APPLICATION_JSON)
                .content("{\"assetId\":1,\"readingValue\":500,\"meterType\":\"ELECTRICITY\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200)).andExpect(jsonPath("$.data.assetId").value(1));
        }
        @Test @DisplayName("POST /energy/calculate-monthly — 计算月度能耗")
        void calculateMonthly() throws Exception {
            EnergyConsumption ec = new EnergyConsumption(); ec.setPeriodStart(LocalDate.of(2026,1,1)); ec.setConsumption(BigDecimal.valueOf(500));
            when(energyService.calculateMonthlyConsumption(1L,"ELECTRICITY",2026,1)).thenReturn(ec);
            mockMvc.perform(post("/energy/calculate-monthly").param("assetId","1").param("meterType","ELECTRICITY")
                .param("year","2026").param("month","1").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200)).andExpect(jsonPath("$.data.consumption").value(500));
        }
        @Test @DisplayName("POST /energy/calculate-monthly — 无读数返回错误")
        void calculateMonthly_noReadings() throws Exception {
            when(energyService.calculateMonthlyConsumption(1L,"ELECTRICITY",2026,1)).thenReturn(null);
            mockMvc.perform(post("/energy/calculate-monthly").param("assetId","1").param("meterType","ELECTRICITY")
                .param("year","2026").param("month","1").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(500)).andExpect(jsonPath("$.message").value("该月份没有读数记录"));
        }
    }

    @Nested @DisplayName("仪表盘与空间聚合")
    class DashboardEndpoints {
        @Test @DisplayName("GET /energy/dashboard")
        void dashboard() throws Exception {
            Map<String,Object> data = new LinkedHashMap<>(); data.put("total",BigDecimal.valueOf(5000));
            when(energyService.getDashboardData(any(),any(),any(),any())).thenReturn(data);
            mockMvc.perform(get("/energy/dashboard").param("startDate","2026-01-01").param("endDate","2026-06-01")
                .param("periodType","MONTH").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200)).andExpect(jsonPath("$.data.total").value(5000));
        }
        @Test @DisplayName("GET /energy/summary/by-location")
        void summaryByLocation() throws Exception {
            when(energyService.getSummaryByLocation(any(),any(),any(),any())).thenReturn(Map.of("total",BigDecimal.valueOf(2000)));
            mockMvc.perform(get("/energy/summary/by-location").param("locationId","1").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        }
        @Test @DisplayName("GET /energy/consumption/aggregate")
        void aggregate() throws Exception {
            when(energyService.getConsumptionByLocation(any(),any(),any(),any())).thenReturn(List.of());
            mockMvc.perform(get("/energy/consumption/aggregate").param("locationId","1").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200)).andExpect(jsonPath("$.data").isArray());
        }
        @Test @DisplayName("GET /energy/by-space — BUILDING")
        void bySpace() throws Exception {
            when(energyService.aggregateBySpace(any(),any(),any(),any(),any())).thenReturn(List.of());
            mockMvc.perform(get("/energy/by-space").param("type","BUILDING").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        }
        @Test @DisplayName("GET /energy/by-space — 无效类型")
        void bySpace_invalidType() throws Exception {
            mockMvc.perform(get("/energy/by-space").param("type","INVALID").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(500)).andExpect(jsonPath("$.message").value("空间类型无效: INVALID"));
        }
        @Test @DisplayName("GET /energy/consumption")
        void getConsumption() throws Exception {
            when(energyService.getConsumptionSummary(any(),any(),any(),any(),any())).thenReturn(List.of());
            mockMvc.perform(get("/energy/consumption").param("assetId","1").param("periodType","MONTH").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        }
    }

    @Nested @DisplayName("同环比、排名与异常")
    class AdvancedEndpoints {
        @Test @DisplayName("GET /energy/compare")
        void compare() throws Exception {
            when(energyService.compareRange(any(),any(),any(),any(),any())).thenReturn(Map.of("changeRate",BigDecimal.valueOf(10.5)));
            mockMvc.perform(get("/energy/compare").param("currentStart","2026-01-01").param("currentEnd","2026-03-31")
                .param("previousStart","2025-01-01").param("previousEnd","2025-03-31").param("periodType","MONTH")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200)).andExpect(jsonPath("$.data.changeRate").value(10.5));
        }
        @Test @DisplayName("GET /energy/ranking")
        void ranking() throws Exception {
            when(energyService.rankingByScope(any(),any(),any(),any())).thenReturn(List.of());
            mockMvc.perform(get("/energy/ranking").param("scope","asset").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200)).andExpect(jsonPath("$.data").isArray());
        }
        @Test @DisplayName("GET /energy/anomalies — 全参数")
        void anomalies() throws Exception {
            when(energyService.detectAnomaliesAuthority(any(),any(),any(),any(),any())).thenReturn(List.of());
            mockMvc.perform(get("/energy/anomalies").param("periodType","MONTH").param("method","zscore").param("threshold","1.5")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        }
        @Test @DisplayName("GET /energy/anomalies — 默认参数")
        void anomalies_default() throws Exception {
            when(energyService.detectAnomaliesAuthority(any(),any(),any(),any(),any())).thenReturn(List.of());
            mockMvc.perform(get("/energy/anomalies").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        }
        @Test @DisplayName("GET /energy/locations/{id}/assets")
        void locationAssets() throws Exception {
            when(energyService.getLocationAssetsWithEnergy(any(),any(),any())).thenReturn(List.of());
            mockMvc.perform(get("/energy/locations/{id}/assets",1L).param("periodType","MONTH").param("withEnergy","true")
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(200));
        }
    }
}
