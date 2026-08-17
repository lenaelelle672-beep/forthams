package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.AuditDistResp;
import com.ams.dto.AuditLogDTO;
import com.ams.dto.AuditLogDetailDTO;
import com.ams.dto.AuditLogStatsDTO;
import com.ams.dto.AuditTrendResp;
import com.ams.dto.OperatorRankingVO;
import com.ams.service.AuditDashboardService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AuditDashboardControllerTest {

    @Mock
    private AuditDashboardService auditDashboardService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new AuditDashboardController(auditDashboardService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldExposeGetOnlyAuditLogLoopWithMaskedResponses() throws Exception {
        grant("system:audit-log:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(auditDashboardService.list(any())).thenReturn(page());
        when(auditDashboardService.detail(7L)).thenReturn(detail());
        when(auditDashboardService.stats(any())).thenReturn(stats());
        when(auditDashboardService.trends(any())).thenReturn(trend());
        when(auditDashboardService.actionTypeDistribution(any())).thenReturn(distribution());
        when(auditDashboardService.operatorRanking(any())).thenReturn(List.of(OperatorRankingVO.builder().rank(1).operatorId("42").operatorName("管理员").count(3L).build()));
        when(auditDashboardService.meta()).thenReturn(Map.of("readonlyBoundary", "GET-only /audit-logs 只读查询", "tenantScoped", true));

        mockMvc.perform(get("/audit-logs?page=1&pageSize=20&operationType=UPDATE").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[0].beforeRecordSummary").value("{\"password\":\"******\"}"))
                .andExpect(jsonPath("$.data.masked").value(true));
        mockMvc.perform(get("/audit-logs/7").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rawPayloadSummary").value("payload(length=10, sha256=abc, preview=token=******)"));
        mockMvc.perform(get("/audit-logs/stats").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.readonlyBoundary").value("GET-only /audit-logs 只读查询"));
        mockMvc.perform(get("/audit-logs/trends").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.granularity").value("daily"));
        mockMvc.perform(get("/audit-logs/action-type-distribution").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.distribution[0].actionType").value("UPDATE"));
        mockMvc.perform(get("/audit-logs/operator-ranking").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].rank").value(1));
        mockMvc.perform(get("/audit-logs/meta").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tenantScoped").value(true));

        for (var builder : List.of(
                post("/audit-logs"),
                put("/audit-logs/7"),
                patch("/audit-logs/7"),
                delete("/audit-logs/7"),
                post("/audit-logs/export")
        )) {
            mockMvc.perform(builder.header("Authorization", "Bearer token").contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isMethodNotAllowed());
        }
    }

    @Test
    void shouldFailClosedWhenBearerUserAuthenticationOrPermissionMissing() throws Exception {
        mockMvc.perform(get("/audit-logs"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        grant("system:audit-log:query");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(null);
        mockMvc.perform(get("/audit-logs").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        SecurityContextHolder.clearContext();
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        mockMvc.perform(get("/audit-logs").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        grant("system:config:query");
        mockMvc.perform(get("/audit-logs").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(auditDashboardService);
    }

    @Test
    void superAdminShouldBypassPermissionCodeOnly() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(99L);
        when(auditDashboardService.list(any())).thenReturn(page());

        mockMvc.perform(get("/audit-logs").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tenantScoped").value(true));

        mockMvc.perform(get("/audit-logs"))
                .andExpect(status().isForbidden());
    }

    private AuditLogDTO.PageResult page() {
        return AuditLogDTO.PageResult.builder()
                .records(List.of(listItem()))
                .total(1)
                .size(20)
                .current(1)
                .pages(1)
                .tenantScoped(true)
                .masked(true)
                .readonlyBoundary("GET-only /audit-logs 只读查询")
                .build();
    }

    private AuditLogDTO listItem() {
        return AuditLogDTO.builder()
                .id(7L)
                .operationType("UPDATE")
                .operatorName("管理员")
                .resourceId("AS****01")
                .beforeRecordSummary("{\"password\":\"******\"}")
                .afterRecordSummary("{\"name\":\"资产A\"}")
                .masked(true)
                .tenantScoped(true)
                .createdAt(LocalDateTime.now())
                .build();
    }

    private AuditLogDetailDTO detail() {
        AuditLogDetailDTO dto = new AuditLogDetailDTO();
        dto.setId(7L);
        dto.setOperationType("UPDATE");
        dto.setRawPayloadSummary("payload(length=10, sha256=abc, preview=token=******)");
        dto.setMasked(true);
        dto.setTenantScoped(true);
        return dto;
    }

    private AuditLogStatsDTO stats() {
        return AuditLogStatsDTO.builder()
                .totalCount(1L)
                .readonlyBoundary("GET-only /audit-logs 只读查询")
                .tenantScoped(true)
                .masked(true)
                .build();
    }

    private AuditTrendResp trend() {
        return AuditTrendResp.builder()
                .granularity("daily")
                .data(List.of(AuditTrendResp.DataPoint.builder().date("2026-07-07").count(1L).build()))
                .tenantScoped(true)
                .readonlyBoundary("GET-only /audit-logs 只读查询")
                .build();
    }

    private AuditDistResp distribution() {
        return AuditDistResp.builder()
                .totalOperations(1L)
                .distribution(List.of(AuditDistResp.DistributionItem.builder().actionType("UPDATE").count(1L).percentage(100D).build()))
                .tenantScoped(true)
                .readonlyBoundary("GET-only /audit-logs 只读查询")
                .build();
    }

    private void grant(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin",
                "n/a",
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()
        ));
    }
}
