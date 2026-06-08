package com.ams.controller;

import com.ams.entity.WorkOrder;
import com.ams.service.WorkOrderService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

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
@DisplayName("WorkOrder Controller Tests")
class WorkOrderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private WorkOrderService workOrderService;

    @ParameterizedTest
    @ValueSource(strings = {"/workorders", "/work-orders"})
    @DisplayName("Should expose work order aliases behind api context path")
    void testWorkOrderAliasesBehindApiContextPath(String path) throws Exception {
        when(workOrderService.queryWorkOrders(any(), any(), any(), any())).thenReturn(new Page<>(1, 10));

        mockMvc.perform(get("/api" + path)
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    @DisplayName("Should route action style approve to operate logic")
    void testApproveActionRoute() throws Exception {
        WorkOrder workOrder = new WorkOrder();
        when(workOrderService.operateWorkOrder(eq(1L), eq("approve"), eq("ok"))).thenReturn(workOrder);

        mockMvc.perform(post("/api/work-orders/{id}/approve", 1L)
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"comment\":\"ok\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(workOrderService).operateWorkOrder(1L, "approve", "ok");
    }
}
