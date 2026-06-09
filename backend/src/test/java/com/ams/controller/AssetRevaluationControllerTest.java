package com.ams.controller;

import com.ams.entity.AssetRevaluation;
import com.ams.security.LoginUser;
import com.ams.service.AssetRevaluationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "server.servlet.context-path=/api")
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Asset Revaluation Controller Tests")
class AssetRevaluationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AssetRevaluationService revaluationService;

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Should ignore forged approvedBy and use authenticated LoginUser")
    void approveUsesAuthenticatedUserId() throws Exception {
        LoginUser loginUser = new LoginUser(
                88L,
                1L,
                "dept:1",
                "approver",
                "",
                List.of("REVALUATION_APPROVER"),
                List.of("revaluation:approve"),
                List.of(new SimpleGrantedAuthority("revaluation:approve")));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(loginUser, null, loginUser.getAuthorities()));

        AssetRevaluation result = new AssetRevaluation();
        result.setId(7L);
        result.setStatus("APPROVED");
        result.setApprovedBy(88L);
        when(revaluationService.approve(eq(7L), eq("APPROVED"), eq(88L))).thenReturn(result);

        mockMvc.perform(post("/api/revaluations/{id}/approve", 7L)
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"APPROVED\",\"approvedBy\":999}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.approvedBy").value(88));

        verify(revaluationService).approve(7L, "APPROVED", 88L);
    }
}
