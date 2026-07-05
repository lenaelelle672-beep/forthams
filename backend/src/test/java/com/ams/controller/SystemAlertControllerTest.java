package com.ams.controller;

import com.ams.dto.SystemAlertDTO;
import com.ams.dto.SystemAlertStatusRequest;
import com.ams.service.SystemAlertService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "server.servlet.context-path=/api")
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("System Alert Controller Tests")
class SystemAlertControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SystemAlertService systemAlertService;

    @MockBean
    private JwtUtil jwtUtil;

    @Test
    @DisplayName("Should pass current user id to status update")
    void updateStatusUsesJwtUserId() throws Exception {
        SystemAlertDTO dto = new SystemAlertDTO();
        dto.setId(7L);
        dto.setStatus("CLOSED");
        when(jwtUtil.getUserIdFromToken("test-token")).thenReturn(42L);
        when(systemAlertService.updateStatus(eq(7L), argThat(request -> "CLOSED".equals(request.getStatus())), eq(42L)))
                .thenReturn(dto);

        mockMvc.perform(put("/api/system-alerts/{id}/status", 7L)
                        .contextPath("/api")
                        .header("Authorization", "Bearer test-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"CLOSED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("CLOSED"));

        verify(systemAlertService).updateStatus(eq(7L), argThat(request -> "CLOSED".equals(request.getStatus())), eq(42L));
    }
}
