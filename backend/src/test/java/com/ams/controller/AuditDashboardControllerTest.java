package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.TrendVO;
import com.ams.entity.GeneralAuditEntry;
import com.ams.service.AuditDashboardService;
import com.ams.service.AuditService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.Date;
import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "server.servlet.context-path=/api")
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Audit dashboard controller tests")
class AuditDashboardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuditService auditService;

    @MockBean
    private AuditDashboardService auditDashboardService;

    @Test
    @DisplayName("Should expose audit-logs list route and pass filters to service")
    void v1ListRoutePassesFiltersToService() throws Exception {
        GeneralAuditEntry entry = new GeneralAuditEntry();
        entry.setId(1001L);
        entry.setOperatorId("U001");
        entry.setOperatorName("审计员");
        entry.setOperationType("DELETE");
        entry.setResourceType("ASSET");
        entry.setResourceId("A-001");
        entry.setAction("删除资产");
        entry.setTimestamp(new Date(1_715_760_000_000L));

        Page<GeneralAuditEntry> page = new Page<>(1, 20);
        page.setRecords(List.of(entry));
        page.setTotal(1);

        when(auditService.queryLogs(
                eq(0),
                eq(20),
                eq("2026-05-01T00:00:00Z"),
                eq("2026-05-02T23:59:59Z"),
                eq("DELETE"),
                eq("U001"),
                eq("ASSET")))
                .thenReturn(Result.success(page));

        mockMvc.perform(get("/api/audit-logs/list")
                        .contextPath("/api")
                        .param("page", "0")
                        .param("size", "20")
                        .param("start_time", "2026-05-01T00:00:00Z")
                        .param("end_time", "2026-05-02T23:59:59Z")
                        .param("operation_type", "DELETE")
                        .param("operator_id", "U001")
                        .param("module", "ASSET"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.records[0].operatorName").value("审计员"));

        verify(auditService).queryLogs(
                0,
                20,
                "2026-05-01T00:00:00Z",
                "2026-05-02T23:59:59Z",
                "DELETE",
                "U001",
                "ASSET");
    }

    @Test
    @DisplayName("Should expose audit-logs trend route and pass snake_case filters")
    void v1TrendRoutePassesFiltersToService() throws Exception {
        TrendVO trend = TrendVO.builder()
                .granularity("weekly")
                .startDate("2026-05-01")
                .endDate("2026-05-31")
                .data(List.of(TrendVO.TrendDataPoint.builder()
                        .date("2026-05-04")
                        .count(3L)
                        .build()))
                .build();

        when(auditDashboardService.getTrend(
                eq(LocalDate.of(2026, 5, 1)),
                eq(LocalDate.of(2026, 5, 31)),
                eq("weekly"),
                eq("DELETE"),
                eq("U001"),
                eq("ASSET")))
                .thenReturn(trend);

        mockMvc.perform(get("/api/audit-logs/trend")
                        .contextPath("/api")
                        .param("start_time", "2026-05-01T00:00:00Z")
                        .param("end_time", "2026-05-31T23:59:59Z")
                        .param("granularity", "weekly")
                        .param("operation_type", "DELETE")
                        .param("operator_id", "U001")
                        .param("module", "ASSET"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.data[0].date").value("2026-05-04"))
                .andExpect(jsonPath("$.data.data[0].count").value(3));

        verify(auditDashboardService).getTrend(
                LocalDate.of(2026, 5, 1),
                LocalDate.of(2026, 5, 31),
                "weekly",
                "DELETE",
                "U001",
                "ASSET");
    }
}
