package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.CustomFieldValueBatchDTO;
import com.ams.entity.*;
import com.ams.mapper.AssetCategoryMapper;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.CustomFieldValueMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CustomFieldValueService {

    private final CustomFieldValueMapper customFieldValueMapper;
    private final CustomFieldService customFieldService;
    private final CustomFieldsetService customFieldsetService;
    private final AssetMapper assetMapper;
    private final AssetCategoryMapper assetCategoryMapper;

    public List<Map<String, Object>> getAssetCustomFields(Long assetId) {
        Asset asset = assetMapper.selectById(assetId);
        if (asset == null) {
            throw new BusinessException("资产不存在");
        }

        List<CustomField> fields = getFieldsForAsset(asset);
        List<CustomFieldValue> existingValues = customFieldValueMapper.selectList(
            new LambdaQueryWrapper<CustomFieldValue>().eq(CustomFieldValue::getAssetId, assetId)
        );
        Map<Long, String> valueMap = existingValues.stream()
            .collect(Collectors.toMap(CustomFieldValue::getFieldId, CustomFieldValue::getFieldValue));

        List<Map<String, Object>> result = new ArrayList<>();
        for (CustomField field : fields) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("fieldId", field.getId());
            item.put("fieldName", field.getFieldName());
            item.put("fieldLabel", field.getFieldLabel());
            item.put("fieldType", field.getFieldType());
            item.put("fieldOptions", field.getFieldOptions());
            item.put("required", field.getRequired());
            item.put("validationPattern", field.getValidationPattern());
            item.put("fieldValue", valueMap.getOrDefault(field.getId(), ""));
            result.add(item);
        }
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public void saveAssetCustomFields(Long assetId, CustomFieldValueBatchDTO dto) {
        Asset asset = assetMapper.selectById(assetId);
        if (asset == null) {
            throw new BusinessException("资产不存在");
        }

        List<CustomField> fields = getFieldsForAsset(asset);
        Map<Long, CustomField> fieldMap = fields.stream().collect(Collectors.toMap(CustomField::getId, f -> f));

        if (dto.getValues() != null) {
            for (CustomFieldValueBatchDTO.FieldValueItem item : dto.getValues()) {
                CustomField field = fieldMap.get(item.getFieldId());
                if (field == null) {
                    throw new BusinessException("字段ID " + item.getFieldId() + " 不属于此资产的字段集");
                }
                customFieldService.validateFieldValues(item.getFieldId(), item.getFieldValue());
            }
        }

        if (dto.getValues() != null) {
            for (CustomFieldValueBatchDTO.FieldValueItem item : dto.getValues()) {
                CustomFieldValue value = customFieldValueMapper.selectOne(
                    new LambdaQueryWrapper<CustomFieldValue>()
                        .eq(CustomFieldValue::getAssetId, assetId)
                        .eq(CustomFieldValue::getFieldId, item.getFieldId())
                );
                if (value == null) {
                    value = new CustomFieldValue();
                    value.setAssetId(assetId);
                    value.setFieldId(item.getFieldId());
                    value.setFieldValue(item.getFieldValue());
                    customFieldValueMapper.insert(value);
                } else {
                    value.setFieldValue(item.getFieldValue());
                    customFieldValueMapper.updateById(value);
                }
            }
        }
    }

    private List<CustomField> getFieldsForAsset(Asset asset) {
        if (asset.getCategoryId() == null) {
            return List.of();
        }
        AssetCategory category = assetCategoryMapper.selectById(asset.getCategoryId());
        if (category == null || category.getFieldsetId() == null) {
            return List.of();
        }
        return customFieldsetService.getFieldsByFieldsetId(category.getFieldsetId());
    }
}
