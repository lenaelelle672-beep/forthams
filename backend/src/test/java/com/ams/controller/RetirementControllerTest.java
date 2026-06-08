package com.ams.controller;

import com.ams.entity.RetirementApplication;
import com.ams.service.RetirementApplicationService;
import com.ams.utils.JwtUtil;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
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
@DisplayName("Retirement Controller Tests")
class RetirementControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RetirementApplicationService retirementApplicationService;

    @MockBean
    private JwtUtil jwtUtil;

    @Test
    @DisplayName("Should expose retirement apply route behind api context path")
    void applyRouteUsesApiContextPathOnlyOnce() throws Exception {
        RetirementApplication application = new RetirementApplication();
        when(jwtUtil.getUserIdFromToken("test-token")).thenReturn(42L);
        when(retirementApplicationService.submitApplication(any(), eq(42L))).thenReturn(application);

        mockMvc.perform(post("/api/retirement/apply")
                        .contextPath("/api")
                        .header("Authorization", "Bearer test-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"asset_id\":12,\"reason\":\"达到报废年限\",\"retirement_type\":\"SCRAP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        ArgumentCaptor<com.ams.dto.RetirementApplyDTO> captor =
                ArgumentCaptor.forClass(com.ams.dto.RetirementApplyDTO.class);
        verify(retirementApplicationService).submitApplication(captor.capture(), eq(42L));
        assertThat(captor.getValue().getAssetId()).isEqualTo(12L);
    }

    @Test
    @DisplayName("Should expose my applications route behind api context path")
    void myApplicationsRouteUsesApiContextPathOnlyOnce() throws Exception {
        when(jwtUtil.getUserIdFromToken("test-token")).thenReturn(42L);
        when(retirementApplicationService.getMyApplications(eq(42L), eq(1), eq(10)))
                .thenReturn(new Page<>(1, 10));

        mockMvc.perform(get("/api/retirement/my-applications")
                        .contextPath("/api")
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(retirementApplicationService).getMyApplications(42L, 1, 10);
    }

    @Test
    @DisplayName("Should expose legacy retirement application create alias without duplicating api prefix")
    void createApplicationAliasUsesRetirementBasePath() throws Exception {
        RetirementApplication application = new RetirementApplication();
        when(jwtUtil.getUserIdFromToken("test-token")).thenReturn(42L);
        when(retirementApplicationService.submitApplication(any(), eq(42L))).thenReturn(application);

        mockMvc.perform(post("/api/retirement/applications")
                        .contextPath("/api")
                        .header("Authorization", "Bearer test-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetId\":12,\"reason\":\"达到报废年限\",\"retirementType\":\"SCRAP\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(retirementApplicationService).submitApplication(any(), eq(42L));
    }

    @Test
    @DisplayName("Should pass keyword and deptId to retirement list service")
    void listPassesKeywordAndDeptId() throws Exception {
        when(retirementApplicationService.queryApplications(eq(1), eq(10), eq("PENDING"), eq(null), eq("A-001"), eq(3L)))
                .thenReturn(new Page<>(1, 10));

        mockMvc.perform(get("/api/retirement/list")
                        .contextPath("/api")
                        .param("status", "PENDING")
                        .param("keyword", "A-001")
                        .param("deptId", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(retirementApplicationService).queryApplications(1, 10, "PENDING", null, "A-001", 3L);
    }

    @Test
    @DisplayName("Should expose retirement cancel alias and call rollback-capable service")
    void cancelAliasCallsService() throws Exception {
        RetirementApplication application = new RetirementApplication();
        application.setId(99L);
        application.setStatus("CANCELLED");
        when(jwtUtil.getUserIdFromToken("test-token")).thenReturn(42L);
        when(retirementApplicationService.getApplicationById(99L)).thenReturn(application);

        mockMvc.perform(post("/api/retirement/99/cancel")
                        .contextPath("/api")
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));

        verify(retirementApplicationService).cancelApplication(99L, 42L);
    }

    @Test
    @DisplayName("Should support body based retirement approve compatibility endpoint")
    void approveBodyCompatibilityEndpoint() throws Exception {
        RetirementApplication application = new RetirementApplication();
        application.setId(99L);
        application.setStatus("APPROVED");
        when(jwtUtil.getUserIdFromToken("test-token")).thenReturn(42L);
        when(retirementApplicationService.approveApplication(99L, 42L)).thenReturn(application);

        mockMvc.perform(post("/api/retirement/approve")
                        .contextPath("/api")
                        .header("Authorization", "Bearer test-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"task_id\":\"99\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("APPROVED"));

        verify(retirementApplicationService).approveApplication(99L, 42L);
    }
}
