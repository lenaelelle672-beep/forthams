package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.ImportExportTaskDTO;
import com.ams.service.ImportExportTaskService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ImportExportTaskControllerTest {

    @Mock
    private ImportExportTaskService importExportTaskService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new ImportExportTaskController(importExportTaskService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listShouldReturnTaskHistory() throws Exception {
        ImportExportTaskDTO.PageResult page = new ImportExportTaskDTO.PageResult();
        page.setTotal(1);
        ImportExportTaskDTO task = new ImportExportTaskDTO();
        task.setId(1L);
        task.setTaskType("IMPORT");
        task.setBusinessObject("asset");
        task.setStatus("SUCCESS");
        task.setSuccessRows(100);
        page.setRecords(List.of(task));
        when(importExportTaskService.list(null, null, null, 1, 20)).thenReturn(page);

        mockMvc.perform(get("/system/import-export/tasks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.records[0].taskType").value("IMPORT"))
                .andExpect(jsonPath("$.data.records[0].status").value("SUCCESS"));
    }

    @Test
    void detailShouldReturnTaskById() throws Exception {
        ImportExportTaskDTO task = new ImportExportTaskDTO();
        task.setId(5L);
        task.setTaskType("EXPORT");
        task.setBusinessObject("asset");
        task.setStatus("FAILED");
        task.setErrorSummary("分类不存在（已脱敏）");
        when(importExportTaskService.detail(5L)).thenReturn(task);

        mockMvc.perform(get("/system/import-export/tasks/5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(5))
                .andExpect(jsonPath("$.data.taskType").value("EXPORT"))
                .andExpect(jsonPath("$.data.errorSummary").value("分类不存在（已脱敏）"));
    }

    @Test
    void metaShouldReturnReadOnlyNotice() throws Exception {
        ImportExportTaskDTO.Meta meta = new ImportExportTaskDTO.Meta();
        meta.setSupportedObjects(List.of("asset"));
        meta.setImportRowLimit(5000);
        meta.setReadOnlyNotice("只读");
        when(importExportTaskService.meta()).thenReturn(meta);

        mockMvc.perform(get("/system/import-export/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.importRowLimit").value(5000));
    }
}
