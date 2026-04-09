package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.CategoryCreateDTO;
import com.ams.dto.CategoryUpdateDTO;
import com.ams.entity.AssetCategory;
import com.ams.mapper.AssetCategoryMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AssetCategory Service Tests")
class AssetCategoryServiceTest {

    @Mock
    private AssetCategoryMapper assetCategoryMapper;

    @InjectMocks
    private AssetCategoryService assetCategoryService;

    @Test
    @DisplayName("Should return paginated results when querying categories")
    void testQuery() {
        Page<AssetCategory> mockPage = new Page<>();
        when(assetCategoryMapper.selectPage(any(), any())).thenReturn(mockPage);

        Page<AssetCategory> result = assetCategoryService.queryCategories(1, 10, null);

        assertThat(result).isNotNull();
        verify(assetCategoryMapper).selectPage(any(), any());
    }

    @Test
    @DisplayName("Should apply keyword filter when querying")
    void testQueryWithKeyword() {
        Page<AssetCategory> mockPage = new Page<>();
        when(assetCategoryMapper.selectPage(any(), any())).thenReturn(mockPage);

        assetCategoryService.queryCategories(1, 10, "test");

        verify(assetCategoryMapper).selectPage(any(Page.class), any(LambdaQueryWrapper.class));
    }

    @Test
    @DisplayName("Should return all categories without pagination")
    void testListAll() {
        List<AssetCategory> mockList = Arrays.asList(new AssetCategory(), new AssetCategory());
        when(assetCategoryMapper.selectList(any())).thenReturn(mockList);

        List<AssetCategory> result = assetCategoryService.listAllCategories();

        assertThat(result).hasSize(2);
        verify(assetCategoryMapper).selectList(any());
    }

    @Test
    @DisplayName("Should return category when found by ID")
    void testGetByIdSuccess() {
        AssetCategory mockCategory = new AssetCategory();
        when(assetCategoryMapper.selectById(1L)).thenReturn(mockCategory);

        AssetCategory result = assetCategoryService.getCategoryById(1L);

        assertThat(result).isNotNull();
        verify(assetCategoryMapper).selectById(1L);
    }

    @Test
    @DisplayName("Should throw exception when category not found")
    void testGetByIdNotFound() {
        when(assetCategoryMapper.selectById(1L)).thenReturn(null);

        assertThatThrownBy(() -> assetCategoryService.getCategoryById(1L))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("不存在");

        verify(assetCategoryMapper).selectById(1L);
    }

    @Test
    @DisplayName("Should create successfully with valid data")
    void testCreate() {
        CategoryCreateDTO createDTO = new CategoryCreateDTO();
        when(assetCategoryMapper.selectOne(any())).thenReturn(null);
        when(assetCategoryMapper.insert(any(AssetCategory.class))).thenReturn(1);

        AssetCategory result = assetCategoryService.createCategory(createDTO);

        assertThat(result).isNotNull();
        verify(assetCategoryMapper).selectOne(any());
        verify(assetCategoryMapper).insert(any(AssetCategory.class));
    }

    @Test
    @DisplayName("Should throw exception when category code already exists")
    void testCreateWithDuplicateCode() {
        CategoryCreateDTO createDTO = new CategoryCreateDTO();
        when(assetCategoryMapper.selectOne(any())).thenReturn(new AssetCategory());

        assertThatThrownBy(() -> assetCategoryService.createCategory(createDTO))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("编码已存在");

        verify(assetCategoryMapper).selectOne(any());
        verify(assetCategoryMapper, never()).insert(any());
    }

    @Test
    @DisplayName("Should update successfully with valid data")
    void testUpdate() {
        AssetCategory existingCategory = new AssetCategory();
        when(assetCategoryMapper.selectById(1L)).thenReturn(existingCategory);
        when(assetCategoryMapper.selectOne(any())).thenReturn(null);
        when(assetCategoryMapper.updateById(any(AssetCategory.class))).thenReturn(1);

        CategoryUpdateDTO updateDTO = new CategoryUpdateDTO();
        AssetCategory result = assetCategoryService.updateCategory(1L, updateDTO);

        assertThat(result).isNotNull();
        verify(assetCategoryMapper).selectById(1L);
        verify(assetCategoryMapper).selectOne(any());
        verify(assetCategoryMapper).updateById(any(AssetCategory.class));
    }

    @Test
    @DisplayName("Should throw exception when updating to duplicate code")
    void testUpdateWithDuplicateCode() {
        AssetCategory existingCategory = new AssetCategory();
        AssetCategory duplicateCategory = new AssetCategory();
        when(assetCategoryMapper.selectById(1L)).thenReturn(existingCategory);
        when(assetCategoryMapper.selectOne(any())).thenReturn(duplicateCategory);

        CategoryUpdateDTO updateDTO = new CategoryUpdateDTO();

        assertThatThrownBy(() -> assetCategoryService.updateCategory(1L, updateDTO))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("编码已存在");

        verify(assetCategoryMapper).selectById(1L);
        verify(assetCategoryMapper).selectOne(any());
        verify(assetCategoryMapper, never()).updateById(any());
    }

    @Test
    @DisplayName("Should delete successfully when category exists")
    void testDelete() {
        AssetCategory existingCategory = new AssetCategory();
        when(assetCategoryMapper.selectById(1L)).thenReturn(existingCategory);
        when(assetCategoryMapper.deleteById(1L)).thenReturn(1);

        assertThatCode(() -> assetCategoryService.deleteCategory(1L)).doesNotThrowAnyException();

        verify(assetCategoryMapper).selectById(1L);
        verify(assetCategoryMapper).deleteById(1L);
    }

    @Test
    @DisplayName("Should throw exception when deleting non-existent category")
    void testDeleteNotFound() {
        when(assetCategoryMapper.selectById(1L)).thenReturn(null);

        assertThatThrownBy(() -> assetCategoryService.deleteCategory(1L))
            .isInstanceOf(BusinessException.class);

        verify(assetCategoryMapper).selectById(1L);
        verify(assetCategoryMapper, never()).deleteById(any());
    }

    @Test
    @DisplayName("Should use default pagination values when null")
    void testQueryWithNullPagination() {
        Page<AssetCategory> mockPage = new Page<>();
        when(assetCategoryMapper.selectPage(any(), any())).thenReturn(mockPage);

        assetCategoryService.queryCategories(null, null, null);

        verify(assetCategoryMapper).selectPage(argThat((Page<AssetCategory> page) ->
            page.getCurrent() == 1 && page.getSize() == 10
        ), any());
    }
}
