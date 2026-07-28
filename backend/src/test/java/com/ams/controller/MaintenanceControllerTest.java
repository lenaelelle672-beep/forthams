package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.MaintenanceCreateDTO;
import com.ams.entity.MaintenanceRecord;
import com.ams.service.MaintenanceService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class MaintenanceControllerTest {

    @Mock
    private MaintenanceService maintenanceService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new MaintenanceController(maintenanceService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listShouldReturnPaginatedMaintenanceRecords() throws Exception {
        when(maintenanceService.queryRecords(eq(1), eq(10), isNull(), isNull())).thenReturn(page());

        mockMvc.perform(get("/maintenance/list?page=1&pageSize=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.records[0].maintenanceType").value("ROUTINE"))
                .andExpect(jsonPath("$.data.records[0].executor").value("张工"))
                .andExpect(jsonPath("$.data.total").value(1));

        verify(maintenanceService).queryRecords(eq(1), eq(10), isNull(), isNull());
    }

    @Test
    void getByIdShouldReturnMaintenanceDetail() throws Exception {
        when(maintenanceService.getRecordById(7L)).thenReturn(record(7L));

        mockMvc.perform(get("/maintenance/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(7))
                .andExpect(jsonPath("$.data.maintenanceType").value("ROUTINE"))
                .andExpect(jsonPath("$.data.executor").value("张工"));

        verify(maintenanceService).getRecordById(7L);
    }

    @Test
    void createShouldSucceedWithValidPayload() throws Exception {
        when(maintenanceService.createRecord(any(MaintenanceCreateDTO.class))).thenReturn(record(7L));

        mockMvc.perform(post("/maintenance")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetId\":1,\"maintenanceType\":\"ROUTINE\",\"executor\":\"张工\",\"content\":\"更换滤芯\",\"cost\":200.00}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(7))
                .andExpect(jsonPath("$.data.maintenanceType").value("ROUTINE"));

        verify(maintenanceService).createRecord(any(MaintenanceCreateDTO.class));
    }

    private Page<MaintenanceRecord> page() {
        Page<MaintenanceRecord> page = new Page<>(1, 10);
        page.setRecords(List.of(record(7L)));
        page.setTotal(1);
        return page;
    }

    private MaintenanceRecord record(Long id) {
        MaintenanceRecord record = new MaintenanceRecord();
        record.setId(id);
        record.setAssetId(1L);
        record.setMaintenanceType("ROUTINE");
        record.setMaintenanceDate(LocalDate.of(2026, 7, 28));
        record.setExecutor("张工");
        record.setContent("更换滤芯");
        record.setCost(new BigDecimal("200.00"));
        return record;
    }
}
