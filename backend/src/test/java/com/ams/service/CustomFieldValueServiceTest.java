package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.dto.CustomFieldValueBatchDTO;
import com.ams.entity.Asset;
import com.ams.entity.AssetCategory;
import com.ams.entity.CustomField;
import com.ams.entity.CustomFieldValue;
import com.ams.mapper.AssetCategoryMapper;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.CustomFieldValueMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomFieldValueServiceTest {

    @Mock
    private CustomFieldValueMapper customFieldValueMapper;

    @Mock
    private CustomFieldService customFieldService;

    @Mock
    private CustomFieldsetService customFieldsetService;

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private AssetCategoryMapper assetCategoryMapper;

    private CustomFieldValueService customFieldValueService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("dept:1");
        customFieldValueService = new CustomFieldValueService(
                customFieldValueMapper,
                customFieldService,
                customFieldsetService,
                assetMapper,
                assetCategoryMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void saveAssetCustomFields_shouldSetTenantOnInsertedValue() {
        setupAssetField();
        when(customFieldValueMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        CustomFieldValueBatchDTO dto = batchValue(9L, "保密等级A");

        customFieldValueService.saveAssetCustomFields(12L, dto);

        ArgumentCaptor<CustomFieldValue> captor = ArgumentCaptor.forClass(CustomFieldValue.class);
        verify(customFieldValueMapper).insert(captor.capture());
        CustomFieldValue value = captor.getValue();
        assertEquals("dept:1", value.getTenantId());
        assertEquals(12L, value.getAssetId());
        assertEquals(9L, value.getFieldId());
        assertEquals("保密等级A", value.getFieldValue());
    }

    @Test
    void saveAssetCustomFields_shouldKeepTenantOnUpdatedValue() {
        setupAssetField();
        CustomFieldValue existing = new CustomFieldValue();
        existing.setId(21L);
        existing.setAssetId(12L);
        existing.setFieldId(9L);
        existing.setFieldValue("旧值");
        when(customFieldValueMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(existing);

        CustomFieldValueBatchDTO dto = batchValue(9L, "新值");

        customFieldValueService.saveAssetCustomFields(12L, dto);

        ArgumentCaptor<CustomFieldValue> captor = ArgumentCaptor.forClass(CustomFieldValue.class);
        verify(customFieldValueMapper).updateById(captor.capture());
        CustomFieldValue value = captor.getValue();
        assertEquals("dept:1", value.getTenantId());
        assertEquals("新值", value.getFieldValue());
    }

    private void setupAssetField() {
        Asset asset = new Asset();
        asset.setId(12L);
        asset.setCategoryId(3L);
        when(assetMapper.selectById(12L)).thenReturn(asset);

        AssetCategory category = new AssetCategory();
        category.setId(3L);
        category.setFieldsetId(5L);
        when(assetCategoryMapper.selectById(3L)).thenReturn(category);

        CustomField field = new CustomField();
        field.setId(9L);
        field.setFieldName("securityLevel");
        field.setFieldLabel("保密等级");
        field.setFieldType("TEXT");
        when(customFieldsetService.getFieldsByFieldsetId(5L)).thenReturn(List.of(field));
    }

    private CustomFieldValueBatchDTO batchValue(Long fieldId, String fieldValue) {
        CustomFieldValueBatchDTO dto = new CustomFieldValueBatchDTO();
        CustomFieldValueBatchDTO.FieldValueItem item = new CustomFieldValueBatchDTO.FieldValueItem();
        item.setFieldId(fieldId);
        item.setFieldValue(fieldValue);
        dto.setValues(List.of(item));
        return dto;
    }
}
