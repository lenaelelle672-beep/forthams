package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.exception.BusinessException;
import com.ams.dto.CategoryCreateDTO;
import com.ams.dto.CategoryUpdateDTO;
import com.ams.entity.AssetCategory;
import com.ams.mapper.AssetCategoryMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.stream.Collectors;
import com.ams.dto.CategoryTreeDTO;

@Service
@RequiredArgsConstructor
public class AssetCategoryService {

    private final AssetCategoryMapper assetCategoryMapper;

    public Page<AssetCategory> queryCategories(Integer page, Integer pageSize, String keyword) {
        Page<AssetCategory> pageParam = new Page<>(page == null ? 1 : page, pageSize == null ? 10 : pageSize);

        LambdaQueryWrapper<AssetCategory> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(AssetCategory::getCategoryName, keyword);
        }

        wrapper.orderByAsc(AssetCategory::getSortOrder).orderByDesc(AssetCategory::getCreateTime);
        return assetCategoryMapper.selectPage(pageParam, wrapper);
    }

    public AssetCategory getCategoryById(Long id) {
        AssetCategory category = assetCategoryMapper.selectById(id);
        if (category == null) {
            throw new BusinessException("资产分类不存在");
        }
        return category;
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetCategory createCategory(CategoryCreateDTO createDTO) {
        AssetCategory existingCategory = assetCategoryMapper.selectOne(
            new LambdaQueryWrapper<AssetCategory>().eq(AssetCategory::getCategoryCode, createDTO.getCategoryCode())
        );
        if (existingCategory != null) {
            throw new BusinessException("分类编码已存在");
        }

        AssetCategory category = new AssetCategory();
        BeanUtil.copyProperties(createDTO, category);
        assetCategoryMapper.insert(category);
        return category;
    }

    @Transactional(rollbackFor = Exception.class)
    public AssetCategory updateCategory(Long id, CategoryUpdateDTO updateDTO) {
        AssetCategory category = getCategoryById(id);

        AssetCategory existingCategory = assetCategoryMapper.selectOne(
            new LambdaQueryWrapper<AssetCategory>()
                .eq(AssetCategory::getCategoryCode, updateDTO.getCategoryCode())
                .ne(AssetCategory::getId, id)
        );
        if (existingCategory != null) {
            throw new BusinessException("分类编码已存在");
        }

        BeanUtil.copyProperties(updateDTO, category, "id", "createTime");
        assetCategoryMapper.updateById(category);
        return category;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteCategory(Long id) {
        getCategoryById(id);
        assetCategoryMapper.deleteById(id);
    }

    public List<AssetCategory> listAllCategories() {
        LambdaQueryWrapper<AssetCategory> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByAsc(AssetCategory::getSortOrder).orderByDesc(AssetCategory::getCreateTime);
        return assetCategoryMapper.selectList(wrapper);
    }

    public List<CategoryTreeDTO> getCategoryTree() {
        // 1. 全量扫描并排序 (依托本机强缓存与 M2 内存直接发酵)
        LambdaQueryWrapper<AssetCategory> wrapper = new LambdaQueryWrapper<>();
        wrapper.orderByAsc(AssetCategory::getSortOrder).orderByDesc(AssetCategory::getCreateTime);
        List<AssetCategory> allCategories = assetCategoryMapper.selectList(wrapper);

        // 2. 映射为 DTO
        List<CategoryTreeDTO> treeDTOList = allCategories.stream().map(c -> {
            CategoryTreeDTO dto = new CategoryTreeDTO();
            BeanUtil.copyProperties(c, dto);
            return dto;
        }).toList();

        // 3. 内存聚合分组：按 parentId 将孩子们圈拢
        Map<Long, List<CategoryTreeDTO>> childrenMap = treeDTOList.stream()
            .filter(c -> c.getParentId() != null)
            .collect(Collectors.groupingBy(CategoryTreeDTO::getParentId));

        // 4. 组装整编
        List<CategoryTreeDTO> rootNodes = new ArrayList<>();
        for (CategoryTreeDTO node : treeDTOList) {
            node.setChildren(childrenMap.getOrDefault(node.getId(), new ArrayList<>()));
            // Null 或者是 0L 认为是根
            if (node.getParentId() == null || node.getParentId() == 0L) {
                rootNodes.add(node);
            }
        }
        return rootNodes;
    }
}
