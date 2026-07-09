package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.FormStorageAttachmentDTO;
import com.ams.dto.FormStorageExportDTO;
import com.ams.dto.FormStorageFieldValueDTO;
import com.ams.dto.FormStorageOperationDTO;
import com.ams.dto.FormStorageQueryDTO;
import com.ams.dto.FormStorageRecordDTO;
import com.ams.dto.FormStorageSaveDTO;
import com.ams.entity.FormAttachment;
import com.ams.entity.FormFieldValue;
import com.ams.entity.FormInstance;
import com.ams.mapper.FormAttachmentMapper;
import com.ams.mapper.FormFieldValueMapper;
import com.ams.mapper.FormInstanceMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FormStorageServiceTest {

    @Mock
    private FormInstanceMapper formInstanceMapper;

    @Mock
    private FormFieldValueMapper formFieldValueMapper;

    @Mock
    private FormAttachmentMapper formAttachmentMapper;

    private FormStorageService formStorageService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("T001");
        formStorageService = new FormStorageService(formInstanceMapper, formFieldValueMapper, formAttachmentMapper, new ObjectMapper());
        lenient().when(formFieldValueMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
        lenient().when(formAttachmentMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldCreateRecordForCurrentTenantAndReturnOnlyMaskedFieldAndAttachmentSummaries() {
        doAnswer(invocation -> {
            FormInstance instance = invocation.getArgument(0);
            instance.setId(18L);
            return 1;
        }).when(formInstanceMapper).insert(any(FormInstance.class));
        doAnswer(invocation -> {
            FormFieldValue value = invocation.getArgument(0);
            value.setId(1L);
            return 1;
        }).when(formFieldValueMapper).insert(any(FormFieldValue.class));
        doAnswer(invocation -> {
            FormAttachment attachment = invocation.getArgument(0);
            attachment.setId(7L);
            return 1;
        }).when(formAttachmentMapper).insert(any(FormAttachment.class));

        FormStorageRecordDTO created = formStorageService.createRecord(saveDto());

        ArgumentCaptor<FormInstance> instanceCaptor = ArgumentCaptor.forClass(FormInstance.class);
        verify(formInstanceMapper).insert(instanceCaptor.capture());
        assertEquals("T001", instanceCaptor.getValue().getTenantId());
        assertEquals("ASSET_FORM", instanceCaptor.getValue().getFormKey());

        ArgumentCaptor<FormFieldValue> fieldCaptor = ArgumentCaptor.forClass(FormFieldValue.class);
        verify(formFieldValueMapper).insert(fieldCaptor.capture());
        assertEquals("T001", fieldCaptor.getValue().getTenantId());
        assertEquals("******", fieldCaptor.getValue().getMaskedValue());
        assertEquals("13800138000", fieldCaptor.getValue().getValueText());

        ArgumentCaptor<FormAttachment> attachmentCaptor = ArgumentCaptor.forClass(FormAttachment.class);
        verify(formAttachmentMapper).insert(attachmentCaptor.capture());
        assertEquals("T001", attachmentCaptor.getValue().getTenantId());
        assertTrue(attachmentCaptor.getValue().getMaskedStorageKey().contains("storageKey 已脱敏"));
        assertFalse(attachmentCaptor.getValue().getStorageRefHash().contains("raw-storage-key"));

        assertEquals("******", created.getFieldSummaries().get(0).getMaskedValue());
        assertNull(created.getFieldSummaries().get(0).getRawValue());
        assertNull(created.getAttachmentSummaries().get(0).getStorageKey());
        assertNull(created.getAttachmentSummaries().get(0).getUrl());
    }

    @Test
    void shouldRejectMissingTenantAndIllegalStateUpdates() {
        TenantContext.clear();
        assertThrows(AccessDeniedException.class, () -> formStorageService.listRecords(new FormStorageQueryDTO()));

        TenantContext.setTenantId("T001");
        FormInstance archived = instance("ARCHIVED");
        when(formInstanceMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(archived);
        BusinessException updateError = assertThrows(BusinessException.class, () -> formStorageService.updateRecord(18L, saveDto()));
        assertTrue(updateError.getMessage().contains("已归档"));

        BusinessException archiveError = assertThrows(BusinessException.class, () -> formStorageService.archiveRecord(18L, operation()));
        assertTrue(archiveError.getMessage().contains("重复归档"));

        FormInstance deleted = instance("DELETED");
        when(formInstanceMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(deleted);
        BusinessException deleteError = assertThrows(BusinessException.class, () -> formStorageService.markDeleted(18L, operation()));
        assertTrue(deleteError.getMessage().contains("重复删除"));
    }

    @Test
    void shouldRegisterAndRemoveAttachmentWithAuditEvidenceAndMaskedReferenceOnly() {
        FormInstance active = instance("ACTIVE");
        when(formInstanceMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(active);
        doAnswer(invocation -> {
            FormAttachment attachment = invocation.getArgument(0);
            attachment.setId(7L);
            return 1;
        }).when(formAttachmentMapper).insert(any(FormAttachment.class));

        FormStorageAttachmentDTO registered = formStorageService.registerAttachment(18L, attachmentDto());

        assertEquals("审计附件.pdf", registered.getFileName());
        assertTrue(registered.getMaskedStorageKey().contains("storageKey 已脱敏"));
        assertNull(registered.getStorageKey());
        assertNull(registered.getUrl());

        FormAttachment attachment = attachment("ACTIVE");
        when(formAttachmentMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(attachment);
        FormStorageAttachmentDTO removed = formStorageService.removeAttachment(18L, 7L, operation());

        assertEquals("DELETED", removed.getStatus());
        assertTrue(removed.getAuditSummary().contains("删除留痕"));
        verify(formAttachmentMapper).updateById(attachment);
    }

    @Test
    void shouldExportMaskedSnapshotAndRequireHighRiskAuditFields() {
        FormInstance active = instance("ACTIVE");
        FormFieldValue field = fieldValue(true, "******");
        FormAttachment attachment = attachment("ACTIVE");
        when(formInstanceMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(active));
        when(formFieldValueMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(field));
        when(formAttachmentMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(attachment));

        FormStorageOperationDTO operation = operation();
        operation.setQuery(new FormStorageQueryDTO());
        FormStorageExportDTO exported = formStorageService.exportMasked(operation);

        assertEquals(1, exported.getTotal());
        assertEquals("******", exported.getMaskedFields().get(0).getMaskedValue());
        assertNull(exported.getMaskedFields().get(0).getRawValue());
        assertTrue((Boolean) exported.getQuerySummary().get("tenantScoped"));
        assertFalse(exported.getQuerySummary().toString().contains("T001"));

        FormStorageOperationDTO missingReason = operation();
        missingReason.setReason(null);
        missingReason.setAuditEvidence(null);
        BusinessException error = assertThrows(BusinessException.class, () -> formStorageService.exportMasked(missingReason));
        assertTrue(error.getMessage().contains("审计原因或审计证据"));
    }

    @Test
    void shouldRejectUnsafePayloadWithoutEchoingRawValue() {
        FormStorageSaveDTO emptyFields = saveDto();
        emptyFields.setFieldValues(List.of());
        assertTrue(assertThrows(BusinessException.class, () -> formStorageService.createRecord(emptyFields)).getMessage().contains("字段值不能为空"));

        FormStorageSaveDTO unsafe = saveDto();
        unsafe.setBusinessKey("<script>token=raw-secret</script>");
        BusinessException error = assertThrows(BusinessException.class, () -> formStorageService.createRecord(unsafe));
        assertTrue(error.getMessage().contains("不安全内容"));
        assertFalse(error.getMessage().contains("raw-secret"));
    }

    private FormStorageSaveDTO saveDto() {
        FormStorageSaveDTO dto = new FormStorageSaveDTO();
        dto.setFormKey("ASSET_FORM");
        dto.setDefinitionVersion(1);
        dto.setBusinessKey("ASSET_CASE_MASKED");
        dto.setOperatorId(42L);
        FormStorageFieldValueDTO field = new FormStorageFieldValueDTO();
        field.setFieldKey("ownerPhone");
        field.setFieldLabel("联系方式");
        field.setValueType("text");
        field.setRawValue("13800138000");
        field.setSensitive(true);
        dto.setFieldValues(List.of(field));
        dto.setAttachments(List.of(attachmentDto()));
        return dto;
    }

    private FormStorageAttachmentDTO attachmentDto() {
        FormStorageAttachmentDTO dto = new FormStorageAttachmentDTO();
        dto.setFileName("审计附件.pdf");
        dto.setContentType("application/pdf");
        dto.setFileSize(2048L);
        dto.setReferenceKey("auditEvidence");
        dto.setStorageKey("raw-storage-key");
        dto.setUrl("https://storage.example/raw-url");
        dto.setOperatorId(42L);
        return dto;
    }

    private FormStorageOperationDTO operation() {
        FormStorageOperationDTO dto = new FormStorageOperationDTO();
        dto.setConfirmed(true);
        dto.setOperatorId(42L);
        dto.setReason("高危操作复核通过");
        dto.setAuditEvidence("FORM_STORAGE_GATE");
        return dto;
    }

    private FormInstance instance(String status) {
        FormInstance instance = new FormInstance();
        instance.setId(18L);
        instance.setTenantId("T001");
        instance.setFormKey("ASSET_FORM");
        instance.setDefinitionVersion(1);
        instance.setBusinessKey("ASSET_CASE_MASKED");
        instance.setStatus(status);
        instance.setDeleted(0);
        return instance;
    }

    private FormFieldValue fieldValue(boolean sensitive, String maskedValue) {
        FormFieldValue value = new FormFieldValue();
        value.setId(1L);
        value.setTenantId("T001");
        value.setInstanceId(18L);
        value.setFormKey("ASSET_FORM");
        value.setFieldKey("ownerPhone");
        value.setFieldLabel("联系方式");
        value.setValueType("text");
        value.setValueText("13800138000");
        value.setSensitive(sensitive);
        value.setMaskedValue(maskedValue);
        return value;
    }

    private FormAttachment attachment(String status) {
        FormAttachment attachment = new FormAttachment();
        attachment.setId(7L);
        attachment.setTenantId("T001");
        attachment.setInstanceId(18L);
        attachment.setFormKey("ASSET_FORM");
        attachment.setFileName("审计附件.pdf");
        attachment.setContentType("application/pdf");
        attachment.setFileSize(2048L);
        attachment.setReferenceKey("auditEvidence");
        attachment.setMaskedStorageKey("storageKey 已脱敏(abcdef)");
        attachment.setMaskedUrl("url 已脱敏(abcdef)");
        attachment.setStatus(status);
        attachment.setAuditSummary("附件引用已登记");
        attachment.setDeleted(0);
        return attachment;
    }
}
