package com.ams.controller;

import com.ams.dto.StocktakingCycleStatsDTO;
import com.ams.entity.StocktakingCycle;
import com.ams.security.LoginUser;
import com.ams.service.StocktakingService;
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

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "server.servlet.context-path=/api",
    "ams.security.method-permission-test-bypass=false"
})
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Stocktaking Cycle Controller Tests")
class StocktakingCycleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private StocktakingService stocktakingService;

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("Should return stocktaking cycle list behind api context path")
    void shouldReturnCycleList() throws Exception {
        authenticateWithQueryPermission();
        StocktakingCycle cycle = new StocktakingCycle();
        cycle.setId(7L);
        cycle.setCycleName("六月循环盘点");
        cycle.setStatus("IN_PROGRESS");
        when(stocktakingService.listCycles("IN_PROGRESS")).thenReturn(List.of(cycle));

        mockMvc.perform(get("/api/stocktaking/cycles")
                .contextPath("/api")
                .param("status", "IN_PROGRESS")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data[0].id").value(7))
            .andExpect(jsonPath("$.data[0].cycleName").value("六月循环盘点"));

        verify(stocktakingService).listCycles("IN_PROGRESS");
    }

    @Test
    @DisplayName("Should return stocktaking cycle detail")
    void shouldReturnCycleDetail() throws Exception {
        authenticateWithQueryPermission();
        StocktakingCycle cycle = new StocktakingCycle();
        cycle.setId(8L);
        cycle.setCycleName("办公区抽盘");
        when(stocktakingService.getCycleById(8L)).thenReturn(cycle);

        mockMvc.perform(get("/api/stocktaking/cycles/{id}", 8L)
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.id").value(8))
            .andExpect(jsonPath("$.data.cycleName").value("办公区抽盘"));

        verify(stocktakingService).getCycleById(8L);
    }

    @Test
    @DisplayName("Should return stocktaking cycle stats")
    void shouldReturnCycleStats() throws Exception {
        authenticateWithQueryPermission();
        when(stocktakingService.getCycleStats(9L))
                .thenReturn(new StocktakingCycleStatsDTO(4, 1, 2, 1, 3));

        mockMvc.perform(get("/api/stocktaking/cycles/{id}/stats", 9L)
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.totalCount").value(4))
            .andExpect(jsonPath("$.data.pendingCount").value(1))
            .andExpect(jsonPath("$.data.completedCount").value(3));

        verify(stocktakingService).getCycleStats(9L);
    }

    private void authenticateWithQueryPermission() {
        LoginUser loginUser = new LoginUser(
                88L,
                1L,
                "dept:1",
                "operator",
                "",
                List.of("USER"),
                List.of("stocktaking:cycle:query"),
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(loginUser, null, loginUser.getAuthorities()));
    }
}
