package com.ams.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("SystemHealthController Tests (merged HealthCheck)")
class SystemHealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("GET /health returns UP status (merged from HealthCheckController)")
    void testHealthCheck() throws Exception {
        mockMvc.perform(get("/health")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("UP"))
            .andExpect(jsonPath("$.service").value("forthAMS"));
    }

    @Test
    @DisplayName("SystemHealthController: /system/health returns UP status")
    void testSystemHealth() throws Exception {
        mockMvc.perform(get("/system/health")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("UP"))
            .andExpect(jsonPath("$.service").value("forthAMS"));
    }

    @Test
    @DisplayName("SystemHealthController: /system/info returns app info")
    void testSystemInfo() throws Exception {
        mockMvc.perform(get("/system/info")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.app").value("forthAMS"))
            .andExpect(jsonPath("$.version").value("1.0.0"));
    }

    @Test
    @DisplayName("HelloController: /hello returns ok status")
    void testHello() throws Exception {
        mockMvc.perform(get("/hello")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ok"))
            .andExpect(jsonPath("$.message").value("forthAMS is running"));
    }
}
