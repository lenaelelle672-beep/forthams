package com.ams.controller;

import com.ams.entity.IdleAssetNotice;
import com.ams.service.IdleAssetService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "server.servlet.context-path=/api")
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Idle Asset Controller Tests")
class IdleAssetControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private IdleAssetService idleAssetService;

    @MockBean
    private JwtUtil jwtUtil;

    @Test
    @DisplayName("Should claim idle asset with user id from JWT")
    void claimUsesJwtUserId() throws Exception {
        IdleAssetNotice notice = new IdleAssetNotice();
        when(jwtUtil.getUserIdFromToken("test-token")).thenReturn(42L);
        when(idleAssetService.claimAsset(eq(9L), eq(42L))).thenReturn(notice);

        mockMvc.perform(post("/api/idle-assets/{id}/claim", 9L)
                        .contextPath("/api")
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(idleAssetService).claimAsset(9L, 42L);
    }
}
