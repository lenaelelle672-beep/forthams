package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.HandoverDTO;
import com.ams.service.HandoverService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Arrays;
import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class HandoverControllerTest {

    @Mock
    private HandoverService handoverService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new HandoverController(handoverService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void listShouldReturnHandoverRecords() throws Exception {
        grant("system:handover:query");
        HandoverDTO.PageResult page = new HandoverDTO.PageResult();
        page.setTotal(1);
        HandoverDTO record = new HandoverDTO();
        record.setId(1L);
        record.setTitle("张三交接");
        record.setStatus("PENDING");
        record.setStatusLabel("待交接");
        record.setAssetCount(5);
        page.setRecords(List.of(record));
        when(handoverService.list(null, null, 1, 20)).thenReturn(page);

        mockMvc.perform(get("/system/handover").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.records[0].title").value("张三交接"))
                .andExpect(jsonPath("$.data.records[0].statusLabel").value("待交接"));
    }

    @Test
    void detailShouldReturnHandoverById() throws Exception {
        grant("system:handover:query");
        HandoverDTO record = new HandoverDTO();
        record.setId(5L);
        record.setTitle("李四交接");
        record.setStatus("COMPLETED");
        record.setStatusLabel("已完成");
        record.setRiskNote("真实转移未闭环");
        when(handoverService.detail(5L)).thenReturn(record);

        mockMvc.perform(get("/system/handover/5").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(5))
                .andExpect(jsonPath("$.data.status").value("COMPLETED"))
                .andExpect(jsonPath("$.data.riskNote").value("真实转移未闭环"));
    }

    @Test
    void metaShouldReturnReadOnlyNotice() throws Exception {
        grant("system:handover:query");
        HandoverDTO.Meta meta = new HandoverDTO.Meta();
        meta.setStatuses(List.of("PENDING", "COMPLETED"));
        meta.setReadOnlyNotice("只读");
        when(handoverService.meta()).thenReturn(meta);

        mockMvc.perform(get("/system/handover/meta").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.statuses[0]").value("PENDING"));
    }

    private void grant(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin",
                "n/a",
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()
        ));
    }
}
