package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.FormStorageAttachmentDTO;
import com.ams.dto.FormStorageExportDTO;
import com.ams.dto.FormStorageFieldValueDTO;
import com.ams.dto.FormStorageRecordDTO;
import com.ams.dto.FormStorageSaveDTO;
import com.ams.service.FormStorageService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class FormStorageControllerTest {

    @Mock
    private FormStorageService formStorageService;

    @Mock
    private JwtUtil jwtUtil;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new FormStorageController(formStorageService, jwtUtil))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldExposeMinimumEndpointsWithFailClosedPermissionsAndMaskedPayloads() throws Exception {
        grant("workflow:form-storage:view", "workflow:form-storage:create", "workflow:form-storage:update", "workflow:form-storage:archive", "workflow:form-storage:delete", "workflow:form-storage:export");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        when(formStorageService.listRecords(any())).thenReturn(List.of(record("ACTIVE")));
        when(formStorageService.getRecord(18L)).thenReturn(record("ACTIVE"));
        when(formStorageService.createRecord(any(FormStorageSaveDTO.class))).thenReturn(record("ACTIVE"));
        when(formStorageService.updateRecord(eq(18L), any(FormStorageSaveDTO.class))).thenReturn(record("ACTIVE"));
        when(formStorageService.archiveRecord(eq(18L), any())).thenReturn(record("ARCHIVED"));
        when(formStorageService.markDeleted(eq(18L), any())).thenReturn(record("DELETED"));
        when(formStorageService.listAttachments(18L)).thenReturn(List.of(attachment()));
        when(formStorageService.registerAttachment(eq(18L), any())).thenReturn(attachment());
        when(formStorageService.removeAttachment(eq(18L), eq(7L), any())).thenReturn(attachment());
        when(formStorageService.exportMasked(any())).thenReturn(exportSnapshot());

        mockMvc.perform(get("/form-storage?formKey=ASSET_FORM").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].fieldSummaries[0].maskedValue").value("******"))
                .andExpect(jsonPath("$.data[0].fieldSummaries[0].rawValue").doesNotExist())
                .andExpect(jsonPath("$.data[0].attachmentSummaries[0].maskedUrl").value("url 已脱敏(abcdef)"))
                .andExpect(jsonPath("$.data[0].attachmentSummaries[0].url").doesNotExist())
                .andExpect(jsonPath("$.data[0].attachmentSummaries[0].storageKey").doesNotExist());
        mockMvc.perform(get("/form-storage/18").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(18));
        mockMvc.perform(post("/form-storage")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(saveJson()))
                .andExpect(status().isOk());
        mockMvc.perform(put("/form-storage/18")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(saveJson()))
                .andExpect(status().isOk());
        mockMvc.perform(post("/form-storage/18/archive")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationJson(42L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"));
        mockMvc.perform(delete("/form-storage/18")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationJson(42L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DELETED"));
        mockMvc.perform(get("/form-storage/18/attachments").header("Authorization", "Bearer token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].maskedStorageKey").value("storageKey 已脱敏(abcdef)"));
        mockMvc.perform(post("/form-storage/18/attachments")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fileName\":\"审计附件.pdf\",\"storageKey\":\"raw-key\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.storageKey").doesNotExist());
        mockMvc.perform(delete("/form-storage/18/attachments/7")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationJson(42L)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/form-storage/export")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationJson(42L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.maskedFields[0].maskedValue").value("******"))
                .andExpect(jsonPath("$.data.maskedFields[0].rawValue").doesNotExist());

        ArgumentCaptor<FormStorageSaveDTO> createCaptor = ArgumentCaptor.forClass(FormStorageSaveDTO.class);
        verify(formStorageService).createRecord(createCaptor.capture());
        assertEquals(42L, createCaptor.getValue().getOperatorId());
    }

    @Test
    void shouldRejectMissingBearerUserAuthenticationAndPermission() throws Exception {
        mockMvc.perform(get("/form-storage"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        grant("workflow:form-storage:view");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(null);
        mockMvc.perform(get("/form-storage").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        SecurityContextHolder.clearContext();
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);
        mockMvc.perform(get("/form-storage").header("Authorization", "Bearer token"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        grant("workflow:form-storage:view");
        mockMvc.perform(post("/form-storage")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(saveJson()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));

        verifyNoInteractions(formStorageService);
    }

    @Test
    void superAdminShouldBypassOnlySpecificPermissionButNotLoginState() throws Exception {
        grant("ROLE_SUPER_ADMIN");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(99L);
        when(formStorageService.exportMasked(any())).thenReturn(exportSnapshot());

        mockMvc.perform(post("/form-storage/export")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationJson(99L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.exportId").value("form-storage-export-1"));

        mockMvc.perform(post("/form-storage/export")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(operationJson(99L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    void highRiskOperationsShouldRequireConfirmedOperatorAndReasonOrEvidence() throws Exception {
        grant("workflow:form-storage:archive", "workflow:form-storage:delete", "workflow:form-storage:export");
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(42L);

        mockMvc.perform(post("/form-storage/18/archive")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirmed\":false,\"operatorId\":42,\"reason\":\"归档\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500));

        mockMvc.perform(delete("/form-storage/18")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirmed\":true,\"reason\":\"删除\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500));

        mockMvc.perform(post("/form-storage/export")
                        .header("Authorization", "Bearer token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirmed\":true,\"operatorId\":42}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(500));

        verifyNoInteractions(formStorageService);
    }

    private FormStorageRecordDTO record(String status) {
        FormStorageRecordDTO dto = new FormStorageRecordDTO();
        dto.setId(18L);
        dto.setFormKey("ASSET_FORM");
        dto.setDefinitionVersion(1);
        dto.setBusinessKey("ASSET_CASE_MASKED");
        dto.setStatus(status);
        dto.setFieldSummary("字段 1 个，敏感字段 1 个，响应仅含 maskedValue");
        dto.setAttachmentSummary("附件引用 1 个，URL/storageKey 已脱敏");
        dto.setFieldSummaries(List.of(field()));
        dto.setAttachmentSummaries(List.of(attachment()));
        return dto;
    }

    private FormStorageFieldValueDTO field() {
        FormStorageFieldValueDTO dto = new FormStorageFieldValueDTO();
        dto.setFieldKey("ownerPhone");
        dto.setFieldLabel("联系方式");
        dto.setSensitive(true);
        dto.setMaskedValue("******");
        return dto;
    }

    private FormStorageAttachmentDTO attachment() {
        FormStorageAttachmentDTO dto = new FormStorageAttachmentDTO();
        dto.setId(7L);
        dto.setInstanceId(18L);
        dto.setFileName("审计附件.pdf");
        dto.setMaskedUrl("url 已脱敏(abcdef)");
        dto.setMaskedStorageKey("storageKey 已脱敏(abcdef)");
        dto.setStatus("ACTIVE");
        return dto;
    }

    private FormStorageExportDTO exportSnapshot() {
        FormStorageExportDTO dto = new FormStorageExportDTO();
        dto.setExportId("form-storage-export-1");
        dto.setQuerySummary(Map.of("tenantScoped", true));
        dto.setRecords(List.of(record("ACTIVE")));
        dto.setMaskedFields(List.of(field()));
        dto.setMaskedAttachments(List.of(attachment()));
        dto.setTotal(1);
        return dto;
    }

    private String saveJson() {
        return "{\"formKey\":\"ASSET_FORM\",\"definitionVersion\":1,\"businessKey\":\"ASSET_CASE_MASKED\",\"fieldValues\":[{\"fieldKey\":\"ownerPhone\",\"fieldLabel\":\"联系方式\",\"valueType\":\"text\",\"rawValue\":\"13800138000\",\"sensitive\":true}]}";
    }

    private String operationJson(Long operatorId) {
        return "{\"confirmed\":true,\"operatorId\":" + operatorId + ",\"reason\":\"高危操作复核通过\",\"auditEvidence\":\"FORM_STORAGE_GATE\"}";
    }

    private void grant(String... authorities) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "admin",
                "n/a",
                Arrays.stream(authorities).map(SimpleGrantedAuthority::new).toList()
        ));
    }
}
