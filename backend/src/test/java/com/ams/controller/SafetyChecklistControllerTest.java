package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.SafetyChecklistBatchResult;
import com.ams.entity.*;
import com.ams.service.SafetyChecklistAttachmentService;
import com.ams.service.SafetyChecklistService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * SafetyChecklistController 集成测试
 *
 * <p>测试覆盖：
 * - 照片上传/查询/删除
 * - PDF 报告生成
 * - 批量执行
 */
@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class SafetyChecklistControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SafetyChecklistService safetyChecklistService;

    @MockBean
    private SafetyChecklistAttachmentService safetyChecklistAttachmentService;

    private SafetyChecklistTemplate template;
    private SafetyChecklistExecution execution;

    @BeforeEach
    void setUp() {
        template = new SafetyChecklistTemplate();
        template.setId(1L);
        template.setTemplateName("测试模板");

        execution = new SafetyChecklistExecution();
        execution.setId(1L);
        execution.setTemplateId(1L);
        execution.setAssetId(100L);
        execution.setExecutorId(1L);
    }

    // ── 照片上传测试 ─────────────────────────────────────────────────────────

    @Test
    void testUploadPhoto_WithValidFile() throws Exception {
        // Arrange
        SysAttachment attachment = new SysAttachment();
        attachment.setId(1L);
        attachment.setFileName("photo.jpg");

        when(safetyChecklistAttachmentService.addAttachment(any(), any(), any(), anyLong(), any(), anyLong()))
                .thenReturn(attachment);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "photo.jpg",
                "image/jpeg",
                "test content".getBytes()
        );

        // Act & Assert
        mockMvc.perform(multipart("/safety-checklists/executions/1/results/1/photos")
                        .file(file)
                        .param("uploadBy", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.fileName").value("photo.jpg"));
    }

    @Test
    void testUploadPhoto_WithInvalidFileType() throws Exception {
        // Arrange
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "document.pdf",
                "application/pdf",
                "test content".getBytes()
        );

        // Act & Assert
        mockMvc.perform(multipart("/safety-checklists/executions/1/results/1/photos")
                        .file(file)
                        .param("uploadBy", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500))
                .andExpect(jsonPath("$.message").value(containsString("不支持的文件类型")));
    }

    @Test
    void testUploadPhoto_WithFileTooLarge() throws Exception {
        // Arrange
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "large.jpg",
                "image/jpeg",
                new byte[6 * 1024 * 1024] // 6MB
        );

        // Act & Assert
        mockMvc.perform(multipart("/safety-checklists/executions/1/results/1/photos")
                        .file(file)
                        .param("uploadBy", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500))
                .andExpect(jsonPath("$.message").value(containsString("文件大小不能超过 5MB")));
    }

    // ── 照片查询测试 ─────────────────────────────────────────────────────────

    @Test
    void testGetPhotos_WithValidExecutionId() throws Exception {
        // Arrange
        SafetyChecklistResult result = new SafetyChecklistResult();
        result.setId(1L);
        result.setExecutionId(1L);
        result.setItemId(1L);
        result.setResult("PASS");
        List<SafetyChecklistResult> results = List.of(result);
        SysAttachment photo = new SysAttachment();
        photo.setId(1L);
        photo.setBusinessType("SAFETY_CHECKLIST_RESULT");
        photo.setBusinessId(1L);
        photo.setFileName("photo.jpg");
        photo.setFilePath("/uploads/1.jpg");
        photo.setFileSize(1024L);
        photo.setFileType("image/jpeg");
        photo.setUploadBy(1L);
        List<SysAttachment> photos = List.of(photo);

        when(safetyChecklistService.getResultsByExecutionId(1L)).thenReturn(results);
        when(safetyChecklistAttachmentService.getAttachments(1L)).thenReturn(photos);

        // Act & Assert
        mockMvc.perform(get("/safety-checklists/executions/1/photos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].fileName").value("photo.jpg"));
    }

    // ── 照片删除测试 ─────────────────────────────────────────────────────────

    @Test
    void testDeletePhoto_WithValidPhotoId() throws Exception {
        // Act & Assert
        mockMvc.perform(delete("/safety-checklists/photos/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
    }

    // ── PDF 报告生成测试 ─────────────────────────────────────────────────────

    @Test
    void testGenerateReport_WithValidExecutionId() throws Exception {
        // Arrange
        byte[] pdfBytes = "PDF content".getBytes();
        when(safetyChecklistService.generateReport(1L)).thenReturn(pdfBytes);

        // Act & Assert
        mockMvc.perform(get("/safety-checklists/executions/1/report"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andExpect(content().bytes(pdfBytes));
    }

    @Test
    void testGenerateReport_WithInvalidExecutionId() throws Exception {
        // Arrange
        when(safetyChecklistService.generateReport(999L))
                .thenThrow(new IllegalArgumentException("执行记录不存在: executionId=999"));

        // Act & Assert
        mockMvc.perform(get("/safety-checklists/executions/999/report"))
                .andExpect(status().isBadRequest());
    }

    // ── 批量执行测试 ─────────────────────────────────────────────────────────

    @Test
    void testBatchStartExecutions_WithValidData() throws Exception {
        // Arrange
        SafetyChecklistBatchResult batchResult = SafetyChecklistBatchResult.builder()
                .successCount(3)
                .failCount(0)
                .failedAssetIds(List.of())
                .results(Map.of(100L, execution))
                .build();

        when(safetyChecklistService.batchStartExecutions(anyLong(), anyList(), anyLong()))
                .thenReturn(batchResult);

        Map<String, Object> params = Map.of(
                "templateId", 1L,
                "assetIds", List.of(100L, 101L, 102L),
                "executorId", 1L
        );

        // Act & Assert
        mockMvc.perform(post("/safety-checklists/executions/batch-start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(params)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.successCount").value(3))
                .andExpect(jsonPath("$.data.failCount").value(0))
                .andExpect(jsonPath("$.data.allSuccess").value(true));
    }

    @Test
    void testBatchStartExecutions_WithPartialFailure() throws Exception {
        // Arrange
        SafetyChecklistBatchResult batchResult = SafetyChecklistBatchResult.builder()
                .successCount(2)
                .failCount(1)
                .failedAssetIds(List.of(102L))
                .results(Map.of(100L, execution))
                .build();

        when(safetyChecklistService.batchStartExecutions(anyLong(), anyList(), anyLong()))
                .thenReturn(batchResult);

        Map<String, Object> params = Map.of(
                "templateId", 1L,
                "assetIds", List.of(100L, 101L, 102L),
                "executorId", 1L
        );

        // Act & Assert
        mockMvc.perform(post("/safety-checklists/executions/batch-start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(params)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.successCount").value(2))
                .andExpect(jsonPath("$.data.failCount").value(1))
                .andExpect(jsonPath("$.data.allSuccess").value(false))
                .andExpect(jsonPath("$.data.failedAssetIds[0]").value(102));
    }
}