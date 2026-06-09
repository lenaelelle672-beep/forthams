package com.ams.controller;

import com.ams.dto.AssetCreateDTO;
import com.ams.dto.AssetQueryDTO;
import com.ams.dto.AssetUpdateDTO;
import com.ams.entity.Asset;
import com.ams.service.AssetService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
                .content("{\"assetNo\":\"AST-2026-0002\",\"assetName\":\"新资产\",\"categoryId\":1,\"status\":\"IDLE\"}"))
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

    @Test
    @DisplayName("Should download CSV import template")
    void downloadImportTemplateReturnsCsv() throws Exception {
        mockMvc.perform(get("/api/assets/import/template")
                .contextPath("/api"))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("text/csv")))
            .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("asset_import_template.csv")));
    }

    @Test
    @DisplayName("Should parse CSV import file")
    void parseImportFileReturnsPreviewRows() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "assets.csv",
                "text/csv",
                "assetNo,assetName,categoryId,status\nAST-1,测试资产,1,IDLE\n".getBytes(java.nio.charset.StandardCharsets.UTF_8));

        mockMvc.perform(multipart("/api/assets/import/parse")
                .file(file)
                .contextPath("/api"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.rows[0].assetNo").value("AST-1"))
            .andExpect(jsonPath("$.data.errors").isArray());
    }

    @Test
    @DisplayName("Should parse escaped CSV fields with commas and quotes")
    void parseImportFileHandlesEscapedCsvFields() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "assets.csv",
                "text/csv",
                ("assetNo,assetName,categoryId,status,remark\n"
                        + "AST-2,\"测试,资产\",1,IDLE,\"备注包含\"\"引号\"\"和,逗号\"\n")
                        .getBytes(java.nio.charset.StandardCharsets.UTF_8));

        mockMvc.perform(multipart("/api/assets/import/parse")
                .file(file)
                .contextPath("/api"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.rows[0].assetName").value("测试,资产"))
            .andExpect(jsonPath("$.data.rows[0].remark").value("备注包含\"引号\"和,逗号"))
            .andExpect(jsonPath("$.data.errors").isArray());
    }

    @Test
    @DisplayName("Should reject non CSV import files with controlled response")
    void parseImportFileRejectsUnsupportedFile() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "assets.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                new byte[] {1, 2, 3});

        mockMvc.perform(multipart("/api/assets/import/parse")
                .file(file)
                .contextPath("/api"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(400))
            .andExpect(jsonPath("$.message").value("当前导入接口支持 CSV 文件，请先下载模板填写后上传"));
    }

    @Test
    @DisplayName("Should reject import commit without rows")
    void commitImportRejectsMissingRows() throws Exception {
        mockMvc.perform(post("/api/assets/import/commit")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(400))
            .andExpect(jsonPath("$.message").value("导入数据不能为空"));
    }

    @Test
    @DisplayName("Should commit valid import rows and keep row-level failures")
    void commitImportReturnsPartialSuccessWithRowErrors() throws Exception {
        Asset created = new Asset();
        created.setId(1L);
        when(assetService.createAsset(any(AssetCreateDTO.class)))
                .thenReturn(created)
                .thenThrow(new IllegalArgumentException("资产编号已存在"));

        mockMvc.perform(post("/api/assets/import/commit")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "rows": [
                            {
                              "rowNumber": 2,
                              "assetNo": "AST-OK",
                              "assetName": "导入成功资产",
                              "categoryId": "10",
                              "status": "IDLE",
                              "deptId": "1",
                              "locationId": "20",
                              "originalValue": "1234.50",
                              "remark": "首行"
                            },
                            {
                              "rowNumber": 3,
                              "assetNo": "AST-DUP",
                              "assetName": "重复资产"
                            }
                          ]
                        }
                        """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.success").value(false))
            .andExpect(jsonPath("$.data.importedCount").value(1))
            .andExpect(jsonPath("$.data.failedCount").value(1))
            .andExpect(jsonPath("$.data.errors[0].rowNumber").value(3))
            .andExpect(jsonPath("$.data.errors[0].message").value("资产编号已存在"));

        ArgumentCaptor<AssetCreateDTO> captor = ArgumentCaptor.forClass(AssetCreateDTO.class);
        verify(assetService, times(2)).createAsset(captor.capture());
        AssetCreateDTO first = captor.getAllValues().get(0);
        assertThat(first.getAssetNo()).isEqualTo("AST-OK");
        assertThat(first.getAssetName()).isEqualTo("导入成功资产");
        assertThat(first.getCategoryId()).isEqualTo(10L);
        assertThat(first.getDeptId()).isEqualTo(1L);
        assertThat(first.getLocationId()).isEqualTo(20L);
        assertThat(first.getOriginalValue()).isEqualByComparingTo(new BigDecimal("1234.50"));
        assertThat(first.getRemark()).isEqualTo("首行");
    }

    @Test
    @DisplayName("Should export assets as CSV")
    void exportAssetsReturnsCsv() throws Exception {
        Page<Asset> page = new Page<>(1, 10);
        Asset asset = new Asset();
        asset.setAssetNo("AST-1");
        asset.setAssetName("测试资产");
        asset.setStatus("IDLE");
        page.setRecords(java.util.List.of(asset));
        when(assetService.queryAssets(any(AssetQueryDTO.class))).thenReturn(page);

        mockMvc.perform(post("/api/assets/export")
                .contextPath("/api")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"IDLE\"}"))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("text/csv")))
            .andExpect(content().string(org.hamcrest.Matchers.containsString("AST-1")));

        ArgumentCaptor<AssetQueryDTO> captor = ArgumentCaptor.forClass(AssetQueryDTO.class);
        verify(assetService, atLeastOnce()).queryAssets(captor.capture());
        assertThat(captor.getValue().getPageSize()).isEqualTo(50000);
    }
}
