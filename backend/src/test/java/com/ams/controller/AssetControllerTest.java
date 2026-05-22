package com.ams.controller;

import com.ams.dto.AssetCreateDTO;
import com.ams.dto.AssetQueryDTO;
import com.ams.dto.AssetUpdateDTO;
import com.ams.entity.Asset;
import com.ams.service.AssetService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "server.servlet.context-path=/api")
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DisplayName("Asset Controller Tests")
class AssetControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AssetService assetService;

    @Test
    @DisplayName("Should list assets with default pagination")
    void listRootReturnsPagedAssets() throws Exception {
        when(assetService.queryAssets(any(AssetQueryDTO.class))).thenReturn(new Page<>(1, 10));

        mockMvc.perform(get("/api/assets")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        ArgumentCaptor<AssetQueryDTO> captor = ArgumentCaptor.forClass(AssetQueryDTO.class);
        verify(assetService).queryAssets(captor.capture());
        assertThat(captor.getValue().getPage()).isEqualTo(1);
        assertThat(captor.getValue().getPageSize()).isEqualTo(10);
    }

    @Test
    @DisplayName("Should list assets with keyword search via /list endpoint")
    void listWithSearchKeyword() throws Exception {
        Page<Asset> mockPage = new Page<>(1, 10);
        Asset asset = new Asset();
        asset.setId(1L);
        asset.setAssetName("测试资产");
        mockPage.setRecords(java.util.List.of(asset));
        when(assetService.queryAssets(any(AssetQueryDTO.class))).thenReturn(mockPage);

        mockMvc.perform(get("/api/assets/list")
                .contextPath("/api")
                .param("keyword", "测试")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.records[0].assetName").value("测试资产"));

        ArgumentCaptor<AssetQueryDTO> captor = ArgumentCaptor.forClass(AssetQueryDTO.class);
        verify(assetService).queryAssets(captor.capture());
        assertThat(captor.getValue().getKeyword()).isEqualTo("测试");
    }

    @Test
    @DisplayName("Should get asset by id")
    void getByIdReturnsAsset() throws Exception {
        Asset asset = new Asset();
        asset.setId(42L);
        asset.setAssetNo("AST-2026-0001");
        asset.setAssetName("笔记本");
        when(assetService.getAssetById(42L)).thenReturn(asset);

        mockMvc.perform(get("/api/assets/{id}", 42L)
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.id").value(42))
            .andExpect(jsonPath("$.data.assetName").value("笔记本"));

        verify(assetService).getAssetById(42L);
    }

    @Test
    @DisplayName("Should create asset")
    void createAsset() throws Exception {
        Asset created = new Asset();
        created.setId(1L);
        created.setAssetName("新资产");
        created.setAssetNo("AST-2026-0002");
        when(assetService.createAsset(any(AssetCreateDTO.class))).thenReturn(created);

        mockMvc.perform(post("/api/assets")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"assetName\":\"新资产\",\"categoryId\":1,\"status\":\"IDLE\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.assetName").value("新资产"));

        verify(assetService).createAsset(any(AssetCreateDTO.class));
    }

    @Test
    @DisplayName("Should update asset by id")
    void updateAsset() throws Exception {
        Asset updated = new Asset();
        updated.setId(42L);
        updated.setAssetName("更新后资产");
        when(assetService.updateAsset(any(Long.class), any(AssetUpdateDTO.class))).thenReturn(updated);

        mockMvc.perform(put("/api/assets/{id}", 42L)
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"assetName\":\"更新后资产\",\"status\":\"IN_USE\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.id").value(42));

        verify(assetService).updateAsset(any(Long.class), any(AssetUpdateDTO.class));
    }

    @Test
    @DisplayName("Should delete asset by id")
    void deleteAsset() throws Exception {
        mockMvc.perform(delete("/api/assets/{id}", 42L)
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(assetService).deleteAsset(42L);
    }

    @Test
    @DisplayName("Should use default pagination when no params provided")
    void listWithDefaultPagination() throws Exception {
        when(assetService.queryAssets(any(AssetQueryDTO.class))).thenReturn(new Page<>());

        mockMvc.perform(get("/api/assets")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        ArgumentCaptor<AssetQueryDTO> captor = ArgumentCaptor.forClass(AssetQueryDTO.class);
        verify(assetService).queryAssets(captor.capture());
        assertThat(captor.getValue().getPage()).isEqualTo(1);
        assertThat(captor.getValue().getPageSize()).isEqualTo(10);
    }

    @Test
    @DisplayName("Should list root endpoint same as /list")
    void listRootEqualsListEndpoint() throws Exception {
        Page<Asset> mockPage = new Page<>(1, 20);
        when(assetService.queryAssets(any(AssetQueryDTO.class))).thenReturn(mockPage);

        mockMvc.perform(get("/api/assets")
                .contextPath("/api")
                .param("pageSize", "20")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        mockMvc.perform(get("/api/assets/list")
                .contextPath("/api")
                .param("pageSize", "20")
                .contentType(MediaType.APPLICATION_JSON))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200));

        verify(assetService, atLeastOnce()).queryAssets(any(AssetQueryDTO.class));
    }
}
