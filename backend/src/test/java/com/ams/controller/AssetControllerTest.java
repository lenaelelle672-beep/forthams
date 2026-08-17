package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.AssetCreateDTO;
import com.ams.entity.Asset;
import com.ams.service.AssetService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AssetControllerTest {

    @Mock
    private AssetService assetService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new AssetController(assetService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listShouldReturnPaginatedAssets() throws Exception {
        when(assetService.queryAssets(any())).thenReturn(page());

        mockMvc.perform(get("/assets/list?page=1&pageSize=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.records[0].assetNo").value("AST-2026-0001"))
                .andExpect(jsonPath("$.data.records[0].assetName").value("笔记本电脑"))
                .andExpect(jsonPath("$.data.total").value(1));

        verify(assetService).queryAssets(any());
    }

    @Test
    void getByIdShouldReturnAssetDetail() throws Exception {
        when(assetService.getAssetById(7L)).thenReturn(asset(7L));

        mockMvc.perform(get("/assets/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(7))
                .andExpect(jsonPath("$.data.assetNo").value("AST-2026-0001"))
                .andExpect(jsonPath("$.data.assetName").value("笔记本电脑"));

        verify(assetService).getAssetById(7L);
    }

    @Test
    void createShouldSucceedWithValidPayload() throws Exception {
        when(assetService.createAsset(any(AssetCreateDTO.class))).thenReturn(asset(7L));

        mockMvc.perform(post("/assets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetName\":\"笔记本电脑\",\"categoryId\":1}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.id").value(7))
                .andExpect(jsonPath("$.data.assetName").value("笔记本电脑"));

        verify(assetService).createAsset(any(AssetCreateDTO.class));
    }

    @Test
    void updateShouldAcceptPayloadThatIncludesTransferFieldsWithoutFailingValidation() throws Exception {
        when(assetService.updateAsset(eq(7L), any())).thenReturn(asset(7L));

        mockMvc.perform(put("/assets/7")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetName\":\"笔记本电脑\",\"deptId\":99,\"userId\":12,\"location\":\"机房\",\"locationId\":5}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(assetService).updateAsset(eq(7L), any());
    }

    @Test
    void createShouldReturn400WhenRequiredFieldMissing() throws Exception {
        mockMvc.perform(post("/assets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryId\":1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    private Page<Asset> page() {
        Page<Asset> page = new Page<>(1, 10);
        page.setRecords(List.of(asset(7L)));
        page.setTotal(1);
        return page;
    }

    private Asset asset(Long id) {
        Asset asset = new Asset();
        asset.setId(id);
        asset.setAssetNo("AST-2026-0001");
        asset.setAssetName("笔记本电脑");
        asset.setCategoryId(1L);
        return asset;
    }
}
