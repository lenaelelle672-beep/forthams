package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.ExecutionMaterialCreateDTO;
import com.ams.dto.ExecutionStartDTO;
import com.ams.dto.ExecutionStepCreateDTO;
import com.ams.dto.ExecutionStepUpdateDTO;
import com.ams.entity.MaintenanceExecution;
import com.ams.entity.MaintenanceExecutionMaterial;
import com.ams.entity.MaintenanceExecutionStep;
import com.ams.entity.User;
import com.ams.mapper.SysAttachmentMapper;
import com.ams.mapper.UserMapper;
import com.ams.service.MaintenanceExecutionMaterialService;
import com.ams.service.MaintenanceExecutionService;
import com.ams.service.MaintenanceExecutionStepService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.springframework.mock.web.MockMultipartFile;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("MaintenanceExecution Controller Tests")
class MaintenanceExecutionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private MaintenanceExecutionService executionService;

    @MockBean
    private MaintenanceExecutionStepService stepService;

    @MockBean
    private MaintenanceExecutionMaterialService materialService;

    @MockBean
    private SysAttachmentMapper sysAttachmentMapper;

    @MockBean
    private UserMapper userMapper;

    // ── Helpers ──────────────────────────────────────────────────────────────

    private MaintenanceExecution createExecution(Long id, String status) {
        MaintenanceExecution e = new MaintenanceExecution();
        e.setId(id);
        e.setTenantId("dept:1");
        e.setMaintenanceRecordId(1L);
        e.setWorkOrderId(10L);
        e.setStatus(status);
        e.setStartTime(LocalDateTime.now());
        e.setTotalLaborHours(BigDecimal.ZERO);
        e.setTotalMaterialCost(BigDecimal.ZERO);
        return e;
    }

    // ── 执行生命周期 ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("POST /maintenance/execution — 开始施工")
    void testStart() throws Exception {
        ExecutionStartDTO dto = new ExecutionStartDTO();
        dto.setMaintenanceRecordId(1L);
        dto.setWorkOrderId(10L);

        MaintenanceExecution execution = createExecution(1L, "RUNNING");
        when(executionService.start(any(ExecutionStartDTO.class))).thenReturn(execution);

        mockMvc.perform(post("/maintenance/execution")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("RUNNING"));

        verify(executionService).start(any(ExecutionStartDTO.class));
    }

    @Test
    @DisplayName("POST /maintenance/execution/{id}/pause — 暂停")
    void testPause() throws Exception {
        MaintenanceExecution execution = createExecution(1L, "PAUSED");
        when(executionService.pause(1L)).thenReturn(execution);

        mockMvc.perform(post("/maintenance/execution/1/pause"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(executionService).pause(1L);
    }

    @Test
    @DisplayName("POST /maintenance/execution/{id}/resume — 恢复")
    void testResume() throws Exception {
        MaintenanceExecution execution = createExecution(1L, "RUNNING");
        when(executionService.resume(1L)).thenReturn(execution);

        mockMvc.perform(post("/maintenance/execution/1/resume"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(executionService).resume(1L);
    }

    @Test
    @DisplayName("POST /maintenance/execution/{id}/complete — 完成")
    void testComplete() throws Exception {
        MaintenanceExecution execution = createExecution(1L, "COMPLETED");
        when(executionService.complete(1L)).thenReturn(execution);

        mockMvc.perform(post("/maintenance/execution/1/complete"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(executionService).complete(1L);
    }

    @Test
    @DisplayName("GET /maintenance/execution/{id} — 查询详情")
    void testGetById() throws Exception {
        MaintenanceExecution execution = createExecution(1L, "RUNNING");
        when(executionService.getById(1L)).thenReturn(execution);

        mockMvc.perform(get("/maintenance/execution/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("RUNNING"));

        verify(executionService).getById(1L);
    }

    @Test
    @DisplayName("GET /maintenance/execution/by-record/{recordId} — 按维保记录查询")
    void testGetByRecord() throws Exception {
        when(executionService.getByMaintenanceRecordId(1L)).thenReturn(List.of());

        mockMvc.perform(get("/maintenance/execution/by-record/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(executionService).getByMaintenanceRecordId(1L);
    }

    @Test
    @DisplayName("GET /maintenance/execution/by-work-order/{workOrderId} — 按工单查询")
    void testGetByWorkOrder() throws Exception {
        when(executionService.getByWorkOrderId(10L)).thenReturn(List.of());

        mockMvc.perform(get("/maintenance/execution/by-work-order/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(executionService).getByWorkOrderId(10L);
    }

    // ── 施工步骤 ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("GET /maintenance/execution/{id}/steps — 获取步骤列表")
    void testGetSteps() throws Exception {
        when(stepService.getSteps(1L)).thenReturn(List.of());

        mockMvc.perform(get("/maintenance/execution/1/steps"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(stepService).getSteps(1L);
    }

    @Test
    @DisplayName("POST /maintenance/execution/{id}/steps — 创建步骤")
    void testCreateStep() throws Exception {
        ExecutionStepCreateDTO dto = new ExecutionStepCreateDTO();
        dto.setExecutionId(1L);
        dto.setStepName("拆卸外壳");
        dto.setLaborHours(new BigDecimal("1.5"));

        MaintenanceExecutionStep step = new MaintenanceExecutionStep();
        step.setId(1L);
        step.setStepName("拆卸外壳");
        when(stepService.createStep(any(ExecutionStepCreateDTO.class))).thenReturn(step);

        mockMvc.perform(post("/maintenance/execution/1/steps")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.stepName").value("拆卸外壳"));

        verify(stepService).createStep(any(ExecutionStepCreateDTO.class));
    }

    @Test
    @DisplayName("PUT /maintenance/execution/{id}/steps/{stepId} — 更新步骤")
    void testUpdateStep() throws Exception {
        ExecutionStepUpdateDTO dto = new ExecutionStepUpdateDTO();
        dto.setStepName("更新步骤名");

        MaintenanceExecutionStep step = new MaintenanceExecutionStep();
        step.setId(1L);
        step.setStepName("更新步骤名");
        when(stepService.updateStep(eq(1L), any(ExecutionStepUpdateDTO.class))).thenReturn(step);

        mockMvc.perform(put("/maintenance/execution/1/steps/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(stepService).updateStep(eq(1L), any(ExecutionStepUpdateDTO.class));
    }

    @Test
    @DisplayName("DELETE /maintenance/execution/{id}/steps/{stepId} — 删除步骤")
    void testDeleteStep() throws Exception {
        mockMvc.perform(delete("/maintenance/execution/1/steps/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(stepService).deleteStep(1L);
    }

    // ── 物料管理 ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("GET /maintenance/execution/{id}/materials — 获取物料列表")
    void testGetMaterials() throws Exception {
        when(materialService.getMaterials(1L)).thenReturn(List.of());

        mockMvc.perform(get("/maintenance/execution/1/materials"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(materialService).getMaterials(1L);
    }

    @Test
    @DisplayName("POST /maintenance/execution/{id}/materials — 添加物料")
    void testAddMaterial() throws Exception {
        ExecutionMaterialCreateDTO dto = new ExecutionMaterialCreateDTO();
        dto.setExecutionId(1L);
        dto.setMaterialName("轴承");
        dto.setQuantity(new BigDecimal("2"));

        MaintenanceExecutionMaterial material = new MaintenanceExecutionMaterial();
        material.setId(1L);
        material.setMaterialName("轴承");
        when(materialService.addMaterial(any(ExecutionMaterialCreateDTO.class))).thenReturn(material);

        mockMvc.perform(post("/maintenance/execution/1/materials")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.materialName").value("轴承"));

        verify(materialService).addMaterial(any(ExecutionMaterialCreateDTO.class));
    }

    @Test
    @DisplayName("DELETE /maintenance/execution/{id}/materials/{materialId} — 删除物料")
    void testDeleteMaterial() throws Exception {
        mockMvc.perform(delete("/maintenance/execution/1/materials/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(materialService).deleteMaterial(1L);
    }

    // ── 照片上传 ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("POST /maintenance/execution/{id}/upload-photo — 上传照片")
    void testUploadPhoto() throws Exception {
        // 设置安全上下文，使 getCurrentUserId 可正常获取用户
        org.springframework.security.core.Authentication auth =
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        "admin", "password", java.util.Collections.emptyList());
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
        // getCurrentUserId 通过 userMapper 按用户名查询用户ID
        User currentUser = new User();
        currentUser.setId(1L);
        currentUser.setUsername("admin");
        currentUser.setStatus(1);
        when(userMapper.selectOne(any())).thenReturn(currentUser);

        MockMultipartFile file = new MockMultipartFile(
                "file",
                "test-photo.jpg",
                "image/jpeg",
                "fake-image-content".getBytes());

        mockMvc.perform(multipart("/maintenance/execution/1/upload-photo")
                        .file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data").isString());
    }

    @Test
    @DisplayName("POST /maintenance/execution/{id}/upload-photo — 空文件应返回错误")
    void testUploadPhotoEmptyFile() throws Exception {
        org.springframework.security.core.Authentication auth =
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        "admin", "password", java.util.Collections.emptyList());
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);

        MockMultipartFile emptyFile = new MockMultipartFile(
                "file",
                "empty.jpg",
                "image/jpeg",
                new byte[0]);

        mockMvc.perform(multipart("/maintenance/execution/1/upload-photo")
                        .file(emptyFile))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
    }
}
