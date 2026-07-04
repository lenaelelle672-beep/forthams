package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.SystemIntegrationInterfaceResponse;
import com.ams.dto.SystemInterfaceTestResponse;
import com.ams.service.SystemIntegrationInterfaceService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class SystemIntegrationInterfaceControllerTest {

    @Mock
    private SystemIntegrationInterfaceService interfaceService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new SystemIntegrationInterfaceController(interfaceService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listShouldExposeV3SystemInterfacesEndpoint() throws Exception {
        SystemIntegrationInterfaceResponse response = response();
        when(interfaceService.list()).thenReturn(List.of(response));

        mockMvc.perform(get("/system/interfaces"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data[0].interfaceName").value("资产同步接口"));
    }

    @Test
    void createShouldRequireBearerUserAndCallV3Service() throws Exception {
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(interfaceService.create(any())).thenReturn(response());

        mockMvc.perform(post("/system/interfaces")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalSystemId\":1,\"interfaceName\":\"资产同步接口\",\"method\":\"GET\",\"path\":\"/asset/sync\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.path").value("/asset/sync"));

        verify(interfaceService).create(any());
    }

    @Test
    void createShouldRejectMissingBearerToken() throws Exception {
        mockMvc.perform(post("/system/interfaces")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalSystemId\":1}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    void testShouldUseConfigOnlyEndpoint() throws Exception {
        SystemInterfaceTestResponse testResponse = new SystemInterfaceTestResponse();
        testResponse.setInterfaceId(7L);
        testResponse.setValid(true);
        testResponse.setConfigOnly(true);
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(interfaceService.testInterface(7L)).thenReturn(testResponse);

        mockMvc.perform(post("/system/interfaces/{id}/test", 7L)
                        .header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.configOnly").value(true));

        verify(interfaceService).testInterface(eq(7L));
    }

    private SystemIntegrationInterfaceResponse response() {
        SystemIntegrationInterfaceResponse response = new SystemIntegrationInterfaceResponse();
        response.setId(7L);
        response.setInterfaceName("资产同步接口");
        response.setMethod("GET");
        response.setPath("/asset/sync");
        response.setEnabled(true);
        return response;
    }
}
