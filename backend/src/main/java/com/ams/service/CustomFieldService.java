package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.dto.CustomFieldCreateDTO;
import com.ams.dto.CustomFieldUpdateDTO;
import com.ams.entity.CustomField;
import com.ams.mapper.CustomFieldMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CustomFieldService {

    private static final Set<String> VALID_TYPES = Set.of(
        "TEXT", "NUMBER", "DATE", "DROPDOWN", "BOOLEAN", "URL", "EMAIL", "REGEX"
    );

    private final CustomFieldMapper customFieldMapper;

    public Page<CustomField> queryFields(Integer page, Integer pageSize, String keyword) {
        Page<CustomField> pageParam = new Page<>(page == null ? 1 : page, pageSize == null ? 10 : pageSize);
        LambdaQueryWrapper<CustomField> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(CustomField::getFieldName, keyword)
                    .or().like(CustomField::getFieldLabel, keyword));
        }
        wrapper.orderByAsc(CustomField::getFieldOrder).orderByDesc(CustomField::getCreatedAt);
        return customFieldMapper.selectPage(pageParam, wrapper);
    }

    public List<CustomField> listAll() {
        LambdaQueryWrapper<CustomField> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CustomField::getStatus, 1).orderByAsc(CustomField::getFieldOrder);
        return customFieldMapper.selectList(wrapper);
    }

    public CustomField getFieldById(Long id) {
        CustomField field = customFieldMapper.selectById(id);
        if (field == null) {
            throw new BusinessException("自定义字段不存在");
        }
        return field;
    }

    @Transactional(rollbackFor = Exception.class)
    public CustomField createField(CustomFieldCreateDTO dto) {
        if (!VALID_TYPES.contains(dto.getFieldType())) {
            throw new BusinessException("无效的字段类型，支持：TEXT/NUMBER/DATE/DROPDOWN/BOOLEAN/URL/EMAIL/REGEX");
        }
        CustomField existing = customFieldMapper.selectOne(
            new LambdaQueryWrapper<CustomField>().eq(CustomField::getFieldName, dto.getFieldName())
        );
        if (existing != null) {
            throw new BusinessException("字段名已存在");
        }
        CustomField field = new CustomField();
        BeanUtil.copyProperties(dto, field, "id");
        customFieldMapper.insert(field);
        return field;
    }

    @Transactional(rollbackFor = Exception.class)
    public CustomField updateField(Long id, CustomFieldUpdateDTO dto) {
        CustomField field = getFieldById(id);
        if (!VALID_TYPES.contains(dto.getFieldType())) {
            throw new BusinessException("无效的字段类型，支持：TEXT/NUMBER/DATE/DROPDOWN/BOOLEAN/URL/EMAIL/REGEX");
        }
        CustomField existing = customFieldMapper.selectOne(
            new LambdaQueryWrapper<CustomField>()
                .eq(CustomField::getFieldName, dto.getFieldName())
                .ne(CustomField::getId, id)
        );
        if (existing != null) {
            throw new BusinessException("字段名已存在");
        }
        BeanUtil.copyProperties(dto, field, "id", "createdAt");
        customFieldMapper.updateById(field);
        return field;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteField(Long id) {
        getFieldById(id);
        customFieldMapper.deleteById(id);
    }

    public void validateFieldValues(Long fieldId, String value) {
        CustomField field = getFieldById(fieldId);
        if (field.getRequired() == 1 && (value == null || value.isBlank())) {
            throw new BusinessException("字段【" + field.getFieldLabel() + "】为必填项");
        }
        if (value == null || value.isBlank()) {
            return;
        }
        switch (field.getFieldType()) {
            case "NUMBER" -> {
                try {
                    Double.parseDouble(value);
                } catch (NumberFormatException e) {
                    throw new BusinessException("字段【" + field.getFieldLabel() + "】必须为数字");
                }
            }
            case "EMAIL" -> {
                if (!value.matches("^[A-Za-z0-9+_.-]+@(.+)$")) {
                    throw new BusinessException("字段【" + field.getFieldLabel() + "】格式不正确");
                }
            }
            case "URL" -> {
                if (!value.matches("^https?://.+")) {
                    throw new BusinessException("字段【" + field.getFieldLabel() + "】必须为有效 URL");
                }
            }
            case "DATE" -> {
                try {
                    java.time.LocalDate.parse(value);
                } catch (Exception e) {
                    throw new BusinessException("字段【" + field.getFieldLabel() + "】必须为日期格式(YYYY-MM-DD)");
                }
            }
            case "DROPDOWN" -> {
                if (field.getFieldOptions() != null && !field.getFieldOptions().isBlank()) {
                    List<String> options = parseJsonOptions(field.getFieldOptions());
                    if (!options.contains(value)) {
                        throw new BusinessException("字段【" + field.getFieldLabel() + "】的值不在可选范围内");
                    }
                }
            }
            case "REGEX" -> {
                if (field.getValidationPattern() != null && !field.getValidationPattern().isBlank()) {
                    if (!value.matches(field.getValidationPattern())) {
                        throw new BusinessException("字段【" + field.getFieldLabel() + "】格式校验不通过");
                    }
                }
            }
            case "BOOLEAN" -> {
                if (!"true".equalsIgnoreCase(value) && !"false".equalsIgnoreCase(value) && !"1".equals(value) && !"0".equals(value)) {
                    throw new BusinessException("字段【" + field.getFieldLabel() + "】必须为布尔值(true/false)");
                }
            }
        }
    }

    private List<String> parseJsonOptions(String json) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            return mapper.readValue(json, List.class);
        } catch (Exception e) {
            return List.of();
        }
    }
}
