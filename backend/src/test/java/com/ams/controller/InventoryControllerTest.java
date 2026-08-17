package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.common.Result;
import com.ams.entity.InventoryTask;
import com.ams.service.InventoryService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import com.ams.dto.InventoryTaskCreateDTO;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class InventoryControllerTest {

    @Mock
    private InventoryService inventoryService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new InventoryController(inventoryService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listShouldReturnPaginatedTasks() throws Exception {
        Page<InventoryTask> page = new Page<>(1, 10);
        page.setRecords(List.of(task(1L)));
        page.setTotal(1);
        when(inventoryService.queryTasks(1, 10, null)).thenReturn(page);

        mockMvc.perform(get("/inventory/tasks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.total").value(1));
    }

    @Test
    void getByIdShouldReturnTask() throws Exception {
        when(inventoryService.getTaskById(1L)).thenReturn(java.util.Map.of("id", 1, "taskName", "年度盘点"));

        mockMvc.perform(get("/inventory/tasks/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    void createShouldSucceedWithValidPayload() throws Exception {
        when(inventoryService.createTask(any(InventoryTaskCreateDTO.class))).thenReturn(task(1L));

        mockMvc.perform(post("/inventory/tasks")
                        .contentType("application/json")
                        .content("{\"taskName\":\"年度盘点\",\"inventoryType\":\"FULL\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    @Test
    void updateStatusShouldDelegateToService() throws Exception {
        when(inventoryService.updateTaskStatus(1L, "IN_PROGRESS")).thenReturn(task(1L));

        mockMvc.perform(put("/inventory/tasks/1/status")
                        .contentType("application/json")
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isOk());

        verify(inventoryService).updateTaskStatus(1L, "IN_PROGRESS");
    }

    @Test
    void requestBodiesShouldRejectForgedStatesAndInvalidScanPayloads() throws Exception {
        mockMvc.perform(put("/inventory/tasks/1/status")
                        .contentType("application/json")
                        .content("{\"status\":\"FORGED\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/inventory/tasks/1/scan")
                        .contentType("application/json")
                        .content("{\"assetId\":0,\"status\":\"FORGED\"}"))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(inventoryService);
    }

    private InventoryTask task(Long id) {
        InventoryTask t = new InventoryTask();
        t.setId(id);
        return t;
    }
}
