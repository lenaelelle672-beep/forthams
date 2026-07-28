package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.AssetTransferDTO;
import com.ams.entity.Asset;
import com.ams.entity.AssetChangeLog;
import com.ams.service.DisposalService;
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
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class DisposalControllerTest {

    @Mock
    private DisposalService disposalService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new DisposalController(disposalService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void historyShouldReturnPaginatedDisposalLogs() throws Exception {
        when(disposalService.getDisposalHistory(eq(1), eq(10), isNull())).thenReturn(page());

        mockMvc.perform(get("/disposals/history?page=1&pageSize=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.records[0].changeType").value("TRANSFER"))
                .andExpect(jsonPath("$.data.records[0].reason").value("部门调整"))
                .andExpect(jsonPath("$.data.total").value(1));

        verify(disposalService).getDisposalHistory(eq(1), eq(10), isNull());
    }

    @Test
    void transferShouldSucceedWithValidPayload() throws Exception {
        when(disposalService.transferAsset(any(AssetTransferDTO.class))).thenReturn(asset());

        mockMvc.perform(post("/disposals/transfer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetId\":7,\"targetDeptId\":2,\"targetUserId\":3,\"targetLocation\":\"北京\",\"reason\":\"部门调整\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("转移成功"))
                .andExpect(jsonPath("$.data.id").value(7))
                .andExpect(jsonPath("$.data.assetNo").value("AST-2026-0001"));

        verify(disposalService).transferAsset(any(AssetTransferDTO.class));
    }

    @Test
    void transferShouldReturn400WhenAssetIdMissing() throws Exception {
        mockMvc.perform(post("/disposals/transfer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetDeptId\":2}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400));
    }

    private Page<AssetChangeLog> page() {
        Page<AssetChangeLog> page = new Page<>(1, 10);
        page.setRecords(List.of(changeLog()));
        page.setTotal(1);
        return page;
    }

    private AssetChangeLog changeLog() {
        AssetChangeLog log = new AssetChangeLog();
        log.setId(1L);
        log.setAssetId(7L);
        log.setChangeType("TRANSFER");
        log.setReason("部门调整");
        log.setOperatorId(1L);
        return log;
    }

    private Asset asset() {
        Asset asset = new Asset();
        asset.setId(7L);
        asset.setAssetNo("AST-2026-0001");
        asset.setAssetName("笔记本电脑");
        asset.setStatus("IN_USE");
        asset.setDeptId(2L);
        asset.setUserId(3L);
        asset.setLocation("北京");
        return asset;
    }
}
