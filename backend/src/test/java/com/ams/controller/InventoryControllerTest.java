package com.ams.controller;

import com.ams.entity.InventoryDetail;
import com.ams.entity.InventoryTask;
import com.ams.service.InventoryService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "server.servlet.context-path=/api")
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Inventory Controller Tests")
class InventoryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private InventoryService inventoryService;

    @Test
    @DisplayName("Should query inventory tasks with pagination and filters")
    void shouldQueryInventoryTasksWithFilters() throws Exception {
        when(inventoryService.queryTasks(2, 20, "IN_PROGRESS", "办公室")).thenReturn(new Page<>(2, 20));

        mockMvc.perform(get("/api/inventory/tasks")
                .contextPath("/api")
                .param("page", "2")
                .param("pageSize", "20")
                .param("status", "IN_PROGRESS")
                .param("search", "办公室")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(inventoryService).queryTasks(2, 20, "IN_PROGRESS", "办公室");
    }

    @Test
    @DisplayName("Should expose task details used by smart report")
    void shouldGetTaskDetailsForSmartReport() throws Exception {
        InventoryDetail detail = new InventoryDetail();
        detail.setId(9L);
        detail.setTaskId(7L);
        detail.setRfidTag("RFID-001");
        detail.setStatus("MATCH");
        when(inventoryService.getTaskDetails(7L)).thenReturn(List.of(detail));

        mockMvc.perform(get("/api/inventory/tasks/{id}/details", 7L)
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data[0].rfidTag").value("RFID-001"));

        verify(inventoryService).getTaskDetails(7L);
    }

    @Test
    @DisplayName("Should add scan result to inventory task")
    void shouldAddScanResult() throws Exception {
        InventoryDetail detail = new InventoryDetail();
        detail.setId(10L);
        detail.setTaskId(7L);
        detail.setRfidTag("RFID-002");
        detail.setStatus("MISMATCH");
        when(inventoryService.addScanResult(eq(7L), any())).thenReturn(detail);

        mockMvc.perform(post("/api/inventory/tasks/{id}/scan", 7L)
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"assetId\":3,\"rfidTag\":\"RFID-002\",\"status\":\"MISMATCH\",\"actualLocation\":\"B座\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.status").value("MISMATCH"));

        verify(inventoryService).addScanResult(eq(7L), any());
    }

    @Test
    @DisplayName("Should submit inventory task through submit route")
    void shouldSubmitInventoryTask() throws Exception {
        InventoryTask task = new InventoryTask();
        task.setId(7L);
        task.setStatus("SUBMITTED");
        when(inventoryService.updateTaskStatus(7L, "SUBMITTED")).thenReturn(task);

        mockMvc.perform(post("/api/inventory/tasks/{id}/submit", 7L)
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.status").value("SUBMITTED"));

        verify(inventoryService).updateTaskStatus(7L, "SUBMITTED");
    }

    @Test
    @DisplayName("Should update selected inventory asset details only when asset ids exist")
    void shouldBatchUpdateAssetsOnlyWhenIdsExist() throws Exception {
        mockMvc.perform(put("/api/inventory/assets/batch")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"assetIds\":[\"1\",\"2\"],\"inventoryStatus\":\"MATCH\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(inventoryService).batchUpdateDetails(List.of("1", "2"), "MATCH");

        mockMvc.perform(put("/api/inventory/assets/batch")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"assetIds\":[],\"inventoryStatus\":\"LOSS\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(inventoryService, never()).batchUpdateDetails(List.of(), "LOSS");
    }
}
