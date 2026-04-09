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
}
