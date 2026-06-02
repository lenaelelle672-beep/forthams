package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.dto.CustomFieldsetCreateDTO;
import com.ams.entity.AssetCategory;
import com.ams.entity.CustomField;
import com.ams.entity.CustomFieldset;
import com.ams.entity.CustomFieldsetField;
import com.ams.mapper.AssetCategoryMapper;
import com.ams.mapper.CustomFieldsetMapper;
import com.ams.mapper.CustomFieldsetFieldMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CustomFieldsetService {

    private final CustomFieldsetMapper customFieldsetMapper;
    private final CustomFieldsetFieldMapper customFieldsetFieldMapper;
    private final CustomFieldService customFieldService;
    private final AssetCategoryMapper assetCategoryMapper;

    public Page<CustomFieldset> queryFieldsets(Integer page, Integer pageSize, String keyword) {
        Page<CustomFieldset> pageParam = new Page<>(page == null ? 1 : page, pageSize == null ? 10 : pageSize);
        LambdaQueryWrapper<CustomFieldset> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(CustomFieldset::getName, keyword);
        }
        wrapper.orderByDesc(CustomFieldset::getCreatedAt);
        return customFieldsetMapper.selectPage(pageParam, wrapper);
    }

    public List<CustomFieldset> listAll() {
        LambdaQueryWrapper<CustomFieldset> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CustomFieldset::getStatus, 1);
        return customFieldsetMapper.selectList(wrapper);
    }

    public CustomFieldset getFieldsetById(Long id) {
        CustomFieldset fieldset = customFieldsetMapper.selectById(id);
        if (fieldset == null) {
            throw new BusinessException("字段集不存在");
        }
        return fieldset;
    }

    @Transactional(rollbackFor = Exception.class)
    public CustomFieldset createFieldset(CustomFieldsetCreateDTO dto) {
        CustomFieldset fieldset = new CustomFieldset();
        BeanUtil.copyProperties(dto, fieldset, "id");
        customFieldsetMapper.insert(fieldset);
        return fieldset;
    }

    @Transactional(rollbackFor = Exception.class)
    public CustomFieldset updateFieldset(Long id, CustomFieldsetCreateDTO dto) {
        CustomFieldset fieldset = getFieldsetById(id);
        BeanUtil.copyProperties(dto, fieldset, "id", "createdAt");
        customFieldsetMapper.updateById(fieldset);
        return fieldset;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteFieldset(Long id) {
        getFieldsetById(id);
        customFieldsetFieldMapper.delete(
            new LambdaQueryWrapper<CustomFieldsetField>().eq(CustomFieldsetField::getFieldsetId, id)
        );
        customFieldsetMapper.deleteById(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public void assignFields(Long fieldsetId, List<Long> fieldIds) {
        getFieldsetById(fieldsetId);
        customFieldsetFieldMapper.delete(
            new LambdaQueryWrapper<CustomFieldsetField>().eq(CustomFieldsetField::getFieldsetId, fieldsetId)
        );
        for (int i = 0; i < fieldIds.size(); i++) {
            CustomFieldsetField rel = new CustomFieldsetField();
            rel.setFieldsetId(fieldsetId);
            rel.setFieldId(fieldIds.get(i));
            rel.setFieldOrder(i);
            customFieldsetFieldMapper.insert(rel);
        }
    }

    public List<CustomField> getFieldsByFieldsetId(Long fieldsetId) {
        getFieldsetById(fieldsetId);
        List<CustomFieldsetField> rels = customFieldsetFieldMapper.selectList(
            new LambdaQueryWrapper<CustomFieldsetField>()
                .eq(CustomFieldsetField::getFieldsetId, fieldsetId)
                .orderByAsc(CustomFieldsetField::getFieldOrder)
        );
        if (rels.isEmpty()) {
            return List.of();
        }
        List<Long> fieldIds = rels.stream().map(CustomFieldsetField::getFieldId).toList();
        List<CustomField> fields = customFieldService.listAll();
        Map<Long, CustomField> fieldMap = fields.stream().collect(Collectors.toMap(CustomField::getId, f -> f));
        return fieldIds.stream().map(fieldMap::get).filter(f -> f != null && f.getStatus() == 1).toList();
    }

    public AssetCategory getFieldsetByCategory(Long categoryId) {
        return assetCategoryMapper.selectById(categoryId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void assignFieldsetToCategory(Long categoryId, Long fieldsetId) {
        AssetCategory category = assetCategoryMapper.selectById(categoryId);
        if (category == null) {
            throw new BusinessException("资产分类不存在");
        }
        if (fieldsetId != null) {
            getFieldsetById(fieldsetId);
        }
        category.setFieldsetId(fieldsetId);
        assetCategoryMapper.updateById(category);
    }
}
