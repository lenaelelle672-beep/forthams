package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.CustomFieldDTO;
import com.ams.dto.CustomFieldMetaDTO;
import com.ams.dto.CustomFieldPreviewRequestDTO;
import com.ams.dto.CustomFieldPreviewRespDTO;
import com.ams.dto.CustomFieldQueryDTO;
import com.ams.entity.CustomField;
import com.ams.mapper.CustomFieldMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomFieldServiceTest {

    @Mock
    private CustomFieldMapper customFieldMapper;

    private CustomFieldService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        service = new CustomFieldService(customFieldMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void listAllDetailAndMetaShouldRemainTenantScoped() {
        CustomFieldQueryDTO query = CustomFieldQueryDTO.builder()
                .page(1)
                .pageSize(20)
                .fieldType("DATE")
                .status(1)
                .keyword("保修")
                .build();
        when(customFieldMapper.countRecords("tenant-a", "DATE", 1, "保修")).thenReturn(1L);
        when(customFieldMapper.selectPageRecords("tenant-a", "DATE", 1, "保修", 20, 0)).thenReturn(List.of(dateField()));
        when(customFieldMapper.selectAllEnabled("tenant-a")).thenReturn(List.of(dateField(), dropdownField()));
        when(customFieldMapper.selectByIdAndTenant("tenant-a", 7L)).thenReturn(dateField());
        when(customFieldMapper.listFieldTypes("tenant-a", 100)).thenReturn(List.of("DATE", "DROPDOWN"));

        CustomFieldDTO.PageResult page = service.list(query);
        assertEquals(1, page.getRecords().size());
        assertEquals(true, page.getTenantScoped());
        assertEquals(2, service.all().size());
        assertEquals("warranty_expiry", service.detail(7L).getFieldName());
        CustomFieldMetaDTO meta = service.meta();
        assertEquals(true, meta.getTenantScoped());
        assertEquals(true, meta.getNoPersistencePreview());
        assertEquals(false, meta.getRuntimeEffect());

        verify(customFieldMapper).countRecords("tenant-a", "DATE", 1, "保修");
        verify(customFieldMapper).selectAllEnabled("tenant-a");
        verify(customFieldMapper).selectByIdAndTenant("tenant-a", 7L);
    }

    @Test
    void previewShouldValidateRequiredTypesOptionsRegexAndNeverPersist() {
        when(customFieldMapper.selectPreviewDefinitions("tenant-a", List.of(9L), List.of("warranty_expiry", "criticality", "secret_note", "unsafe_code")))
                .thenReturn(List.of(dateField(), dropdownField(), encryptedField(), unsafeRegexField()));
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("warranty_expiry", "2026-12-31");
        values.put("criticality", "非法选项");
        values.put("secret_note", rawSecret());
        values.put("unsafe_code", "aaaaaaaaaaaaaaaa");
        values.put("9", "by-id");

        CustomFieldPreviewRespDTO response = service.preview(CustomFieldPreviewRequestDTO.builder()
                .values(values)
                .build());

        assertEquals(false, response.getValid());
        assertEquals(true, response.getNoPersistence());
        assertEquals(false, response.getRuntimeEffect());
        assertTrue(response.getRejected().stream().anyMatch(item -> "criticality".equals(item.getFieldName())));
        assertTrue(response.getRejected().stream().anyMatch(item -> "unsafe_code".equals(item.getFieldName())));
        assertTrue(response.getUsedFields().stream().anyMatch(item -> Boolean.TRUE.equals(item.getEncrypted())));
        assertFalse(response.toString().contains(rawSecret()));
    }

    @Test
    void previewShouldReportMissingAndCrossTenantFieldsWithoutFallback() {
        when(customFieldMapper.selectPreviewDefinitions("tenant-a", List.of(404L), List.of("warranty_expiry")))
                .thenReturn(List.of(dateField()));
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("warranty_expiry", "");
        values.put("404", "跨租户字段");

        CustomFieldPreviewRespDTO response = service.preview(CustomFieldPreviewRequestDTO.builder()
                .values(values)
                .build());

        assertEquals(false, response.getValid());
        assertTrue(response.getMissing().stream().anyMatch(item -> "warranty_expiry".equals(item.getFieldName())));
        assertTrue(response.getRejected().stream().anyMatch(item -> Long.valueOf(404L).equals(item.getFieldId())));
        assertTrue(response.getErrors().toString().contains("当前租户"));
    }

    @Test
    void invalidDetailAndMissingTenantShouldFailClosedBeforeMapper() {
        when(customFieldMapper.selectByIdAndTenant("tenant-a", 404L)).thenReturn(null);
        assertThrows(BusinessException.class, () -> service.detail(404L));

        TenantContext.clear();
        assertThrows(AccessDeniedException.class, () -> service.list(new CustomFieldQueryDTO()));
        verifyNoInteractionsAfterTenantClear();
    }

    @Test
    void previewShouldRequireTenantBeforeMapper() {
        TenantContext.clear();

        assertThrows(AccessDeniedException.class, () -> service.preview(new CustomFieldPreviewRequestDTO()));
        verifyNoInteractions(customFieldMapper);
    }

    private void verifyNoInteractionsAfterTenantClear() {
        verify(customFieldMapper).selectByIdAndTenant("tenant-a", 404L);
    }

    private CustomField dateField() {
        CustomField field = new CustomField();
        field.setId(7L);
        field.setTenantId("tenant-a");
        field.setFieldName("warranty_expiry");
        field.setFieldLabel("保修到期");
        field.setFieldType("DATE");
        field.setRequired(1);
        field.setEncrypted(0);
        field.setStatus(1);
        field.setFieldOrder(10);
        return field;
    }

    private CustomField dropdownField() {
        CustomField field = new CustomField();
        field.setId(8L);
        field.setTenantId("tenant-a");
        field.setFieldName("criticality");
        field.setFieldLabel("重要级别");
        field.setFieldType("DROPDOWN");
        field.setFieldOptions("[\"高\",\"中\",\"低\"]");
        field.setRequired(0);
        field.setEncrypted(0);
        field.setStatus(1);
        field.setFieldOrder(20);
        return field;
    }

    private CustomField encryptedField() {
        CustomField field = new CustomField();
        field.setId(9L);
        field.setTenantId("tenant-a");
        field.setFieldName("secret_note");
        field.setFieldLabel("敏感备注");
        field.setFieldType("TEXT");
        field.setRequired(0);
        field.setEncrypted(1);
        field.setStatus(1);
        field.setFieldOrder(30);
        return field;
    }

    private CustomField unsafeRegexField() {
        CustomField field = new CustomField();
        field.setId(10L);
        field.setTenantId("tenant-a");
        field.setFieldName("unsafe_code");
        field.setFieldLabel("高风险正则");
        field.setFieldType("REGEX");
        field.setValidationPattern("(a+)+$");
        field.setRequired(0);
        field.setEncrypted(0);
        field.setStatus(1);
        field.setFieldOrder(40);
        return field;
    }

    private String rawSecret() {
        return "raw-custom-field-secret";
    }
}
