package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.CustomFieldDTO;
import com.ams.dto.CustomFieldsetDTO;
import com.ams.dto.CustomFieldsetMetaDTO;
import com.ams.dto.CustomFieldsetPreviewRequestDTO;
import com.ams.dto.CustomFieldsetPreviewRespDTO;
import com.ams.dto.CustomFieldsetQueryDTO;
import com.ams.entity.CustomField;
import com.ams.entity.CustomFieldset;
import com.ams.mapper.CustomFieldsetMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomFieldsetServiceTest {

    @Mock
    private CustomFieldsetMapper customFieldsetMapper;

    private CustomFieldsetService service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("tenant-a");
        service = new CustomFieldsetService(customFieldsetMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void listAllDetailFieldsByCategoryAndMetaShouldRemainTenantScoped() {
        CustomFieldsetQueryDTO query = CustomFieldsetQueryDTO.builder()
                .page(1)
                .pageSize(20)
                .status(1)
                .categoryId(12L)
                .keyword("IT")
                .build();
        when(customFieldsetMapper.countRecords("tenant-a", 1, 12L, "IT")).thenReturn(1L);
        when(customFieldsetMapper.selectPageRecords("tenant-a", 1, 12L, "IT", 20, 0)).thenReturn(List.of(fieldset()));
        when(customFieldsetMapper.selectAllEnabled("tenant-a")).thenReturn(List.of(fieldset()));
        when(customFieldsetMapper.selectByIdAndTenant("tenant-a", 3L)).thenReturn(fieldset());
        when(customFieldsetMapper.selectFieldsByFieldsetId("tenant-a", 3L)).thenReturn(List.of(dateField()));
        when(customFieldsetMapper.selectByCategory("tenant-a", 12L)).thenReturn(fieldset());

        CustomFieldsetDTO.PageResult page = service.list(query);
        assertEquals(1, page.getRecords().size());
        assertEquals(true, page.getTenantScoped());
        assertEquals(1, service.all().size());
        assertEquals("IT 设备字段集", service.detail(3L).getName());
        List<CustomFieldDTO> fields = service.fields(3L);
        assertEquals("warranty_expiry", fields.get(0).getFieldName());
        assertEquals("IT 设备字段集", service.byCategory(12L).getName());
        CustomFieldsetMetaDTO meta = service.meta();
        assertEquals(true, meta.getTenantScoped());
        assertEquals(true, meta.getNoPersistencePreview());
        assertEquals(false, meta.getRuntimeEffect());

        verify(customFieldsetMapper).countRecords("tenant-a", 1, 12L, "IT");
        verify(customFieldsetMapper).selectAllEnabled("tenant-a");
        verify(customFieldsetMapper, times(2)).selectByIdAndTenant("tenant-a", 3L);
        verify(customFieldsetMapper).selectByCategory("tenant-a", 12L);
    }

    @Test
    void previewShouldValidateFieldsCategoryAndNeverPersist() {
        when(customFieldsetMapper.selectByIdAndTenant("tenant-a", 3L)).thenReturn(fieldset());
        when(customFieldsetMapper.selectPreviewFields("tenant-a", List.of(7L, 404L))).thenReturn(List.of(dateField()));

        CustomFieldsetPreviewRespDTO response = service.preview(CustomFieldsetPreviewRequestDTO.builder()
                .fieldsetId(3L)
                .fieldIds(List.of(7L, 404L))
                .categoryId(12L)
                .build());

        assertEquals(false, response.getValid());
        assertEquals(true, response.getNoPersistence());
        assertEquals(false, response.getRuntimeEffect());
        assertEquals(true, response.getWouldBindCategory());
        assertTrue(response.getUsedFields().stream().anyMatch(item -> Long.valueOf(7L).equals(item.getFieldId())));
        assertTrue(response.getMissingFields().stream().anyMatch(item -> Long.valueOf(404L).equals(item.getFieldId())));
    }

    @Test
    void previewShouldRejectCrossTenantFieldsetAndCategoryWithoutFallback() {
        when(customFieldsetMapper.selectByIdAndTenant("tenant-a", 99L)).thenReturn(null);
        when(customFieldsetMapper.countCategoryBindings("tenant-a", 44L)).thenReturn(0L);

        CustomFieldsetPreviewRespDTO response = service.preview(CustomFieldsetPreviewRequestDTO.builder()
                .fieldsetId(99L)
                .fieldIds(List.of(-1L, 7L, 7L))
                .categoryId(44L)
                .build());

        assertEquals(false, response.getValid());
        assertEquals(false, response.getWouldBindCategory());
        assertTrue(response.getRejectedFields().stream().anyMatch(item -> Long.valueOf(99L).equals(item.getFieldId())));
        assertTrue(response.getRejectedFields().stream().anyMatch(item -> Long.valueOf(-1L).equals(item.getFieldId())));
        assertTrue(response.getErrors().toString().contains("当前租户"));
    }

    @Test
    void invalidDetailAndMissingTenantShouldFailClosedBeforeMapper() {
        when(customFieldsetMapper.selectByIdAndTenant("tenant-a", 404L)).thenReturn(null);
        assertThrows(BusinessException.class, () -> service.detail(404L));

        TenantContext.clear();
        assertThrows(AccessDeniedException.class, () -> service.list(new CustomFieldsetQueryDTO()));
        verify(customFieldsetMapper).selectByIdAndTenant("tenant-a", 404L);
    }

    @Test
    void previewShouldRequireTenantBeforeMapper() {
        TenantContext.clear();

        assertThrows(AccessDeniedException.class, () -> service.preview(new CustomFieldsetPreviewRequestDTO()));
        verifyNoInteractions(customFieldsetMapper);
    }

    private CustomFieldset fieldset() {
        CustomFieldset fieldset = new CustomFieldset();
        fieldset.setId(3L);
        fieldset.setTenantId("tenant-a");
        fieldset.setName("IT 设备字段集");
        fieldset.setDescription("IT 设备扩展字段");
        fieldset.setCategoryId(12L);
        fieldset.setSortOrder(10);
        fieldset.setStatus(1);
        fieldset.setFieldCount(2);
        return fieldset;
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
}
