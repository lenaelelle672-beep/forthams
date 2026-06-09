package com.ams.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("SecurityFilterChain behavior")
class SecurityFilterChainBehaviorTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthShouldStayPublicEvenWhenClientSendsStaleBearerHeader() throws Exception {
        mockMvc.perform(get("/system/health")
                        .header("Authorization", "Bearer stale-system-token")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void vendorPortalShouldReachVendorTokenBoundaryOutsideSystemJwtFilter() throws Exception {
        mockMvc.perform(get("/vendor-portal/contracts")
                        .param("vendorId", "7")
                        .header("Authorization", "Bearer stale-system-token")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.message").value("供应商登录已过期"));
    }

    @Test
    void protectedEndpointShouldStillRequireSystemAuthentication() throws Exception {
        mockMvc.perform(get("/user-management/current")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized())
                .andExpect(content().json("{\"code\":401,\"message\":\"未登录或登录已过期\"}"));
    }
}
