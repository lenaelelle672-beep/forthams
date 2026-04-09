package com.ams.controller;

import com.ams.dto.CategoryCreateDTO;
import com.ams.dto.CategoryUpdateDTO;
import com.ams.entity.AssetCategory;
import com.ams.service.AssetCategoryService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("AssetCategory Controller Tests")
class AssetCategoryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AssetCategoryService assetCategoryService;

    @BeforeEach
    void setUp() {
    }

    @Test
    @DisplayName("Should return paginated list when querying categories")
    void testQueryList() throws Exception {
        Page<AssetCategory> mockPage = new Page<>(1, 10);
        when(assetCategoryService.queryCategories(any(), any(), any())).thenReturn(mockPage);

        mockMvc.perform(get("/categories/list")
                .param("page", "1")
                .param("pageSize", "10")
                .param("keyword", "test")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(assetCategoryService).queryCategories(1, 10, "test");
    }

    @Test
    @DisplayName("Should return all categories without pagination")
    void testGetAllCategories() throws Exception {
        List<AssetCategory> mockList = Arrays.asList(new AssetCategory(), new AssetCategory());
        when(assetCategoryService.listAllCategories()).thenReturn(mockList);

        mockMvc.perform(get("/categories/all")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data").isArray());

        verify(assetCategoryService).listAllCategories();
    }

    @Test
    @DisplayName("Should return category when getting by valid ID")
    void testGetById() throws Exception {
        AssetCategory mockCategory = new AssetCategory();
        when(assetCategoryService.getCategoryById(1L)).thenReturn(mockCategory);

        mockMvc.perform(get("/categories/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(assetCategoryService).getCategoryById(1L);
    }

    @Test
    @DisplayName("Should create successfully with valid data")
    void testCreate() throws Exception {
        String requestBody = "{\"categoryName\":\"New Category\",\"categoryCode\":\"CAT001\"}";

        AssetCategory mockResult = new AssetCategory();

        when(assetCategoryService.createCategory(any(CategoryCreateDTO.class))).thenReturn(mockResult);

        mockMvc.perform(post("/categories")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.message").value("创建成功"));

        verify(assetCategoryService).createCategory(any(CategoryCreateDTO.class));
    }

    @Test
    @DisplayName("Should update successfully with valid data")
    void testUpdate() throws Exception {
        String requestBody = "{\"categoryName\":\"Updated Category\",\"categoryCode\":\"CAT001\"}";

        AssetCategory mockResult = new AssetCategory();

        when(assetCategoryService.updateCategory(eq(1L), any(CategoryUpdateDTO.class))).thenReturn(mockResult);

        mockMvc.perform(put("/categories/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.message").value("更新成功"));

        verify(assetCategoryService).updateCategory(eq(1L), any(CategoryUpdateDTO.class));
    }

    @Test
    @DisplayName("Should delete successfully with valid ID")
    void testDelete() throws Exception {
        mockMvc.perform(delete("/categories/{id}", 1L)
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.message").value("删除成功"));

        verify(assetCategoryService).deleteCategory(1L);
    }

    @Test
    @DisplayName("Should return 400 when creating with empty name")
    void testCreateWithInvalidData() throws Exception {
        String invalidRequest = "{\"categoryCode\":\"CAT001\"}";

        mockMvc.perform(post("/categories")
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalidRequest))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Should return 400 when creating with empty code")
    void testCreateWithEmptyCode() throws Exception {
        String invalidRequest = "{\"categoryName\":\"Test\"}";

        mockMvc.perform(post("/categories")
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalidRequest))
            .andExpect(status().isBadRequest());
    }
}
