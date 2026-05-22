package com.ams.controller;

import com.ams.dto.MaintenanceCreateDTO;
import com.ams.dto.MaintenanceUpdateDTO;
import com.ams.entity.MaintenanceRecord;
import com.ams.service.MaintenanceService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Maintenance Controller Tests")
class MaintenanceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private MaintenanceService maintenanceService;

    @Test
    @DisplayName("Should return paginated maintenance records")
    void testList() throws Exception {
        Page<MaintenanceRecord> mockPage = new Page<>(1, 10);
        when(maintenanceService.queryRecords(anyInt(), anyInt(), any(), any())).thenReturn(mockPage);

        mockMvc.perform(get("/maintenance/list")
                .param("page", "1")
                .param("pageSize", "10")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(maintenanceService).queryRecords(1, 10, null, null);
    }

    @Test
    @DisplayName("Should return maintenance record by ID")
    void testGetById() throws Exception {
        MaintenanceRecord record = new MaintenanceRecord();
        record.setId(1L);

        when(maintenanceService.getRecordById(1L)).thenReturn(record);

        mockMvc.perform(get("/maintenance/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.id").value(1));

        verify(maintenanceService).getRecordById(1L);
    }

    @Test
    @DisplayName("Should return upcoming maintenance records")
    void testUpcoming() throws Exception {
        when(maintenanceService.getUpcomingMaintenance(30)).thenReturn(List.of());

        mockMvc.perform(get("/maintenance/upcoming")
                .param("days", "30")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(maintenanceService).getUpcomingMaintenance(30);
    }

    @Test
    @DisplayName("Should create maintenance record successfully")
    void testCreate() throws Exception {
        MaintenanceCreateDTO dto = new MaintenanceCreateDTO();
        dto.setAssetId(1L);
        dto.setMaintenanceType("PREVENTIVE");

        MaintenanceRecord saved = new MaintenanceRecord();
        saved.setId(10L);

        when(maintenanceService.createRecord(any(MaintenanceCreateDTO.class))).thenReturn(saved);

        mockMvc.perform(post("/maintenance")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(maintenanceService).createRecord(any(MaintenanceCreateDTO.class));
    }

    @Test
    @DisplayName("Should update maintenance record successfully")
    void testUpdate() throws Exception {
        MaintenanceUpdateDTO dto = new MaintenanceUpdateDTO();
        dto.setContent("Updated content");

        MaintenanceRecord updated = new MaintenanceRecord();
        updated.setId(1L);

        when(maintenanceService.updateRecord(eq(1L), any(MaintenanceUpdateDTO.class))).thenReturn(updated);

        mockMvc.perform(put("/maintenance/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(maintenanceService).updateRecord(eq(1L), any(MaintenanceUpdateDTO.class));
    }

    @Test
    @DisplayName("Should delete maintenance record successfully")
    void testDelete() throws Exception {
        mockMvc.perform(delete("/maintenance/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(maintenanceService).deleteRecord(1L);
    }
}
