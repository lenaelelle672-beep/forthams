package com.ams.controller;

import com.ams.common.GlobalExceptionHandler;
import com.ams.dto.AssetTransferDTO;
import com.ams.entity.AssetChangeLog;
import com.ams.entity.DisposalApplication;
import com.ams.enums.DisposalStatus;
import com.ams.enums.DisposalType;
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
import java.util.Map;

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
    void listAndDetailShouldUseDisposalApplicationEndpoints() throws Exception {
        when(disposalService.queryApplications(eq(1), eq(10), eq(DisposalType.TRANSFER),
                eq(DisposalStatus.PENDING), eq("部门"))).thenReturn(applicationPage());
        when(disposalService.getApplicationDetail(7L)).thenReturn(application());

        mockMvc.perform(get("/disposals?page=1&pageSize=10&disposalType=TRANSFER&status=PENDING&keyword=部门"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.records[0].id").value(7))
                .andExpect(jsonPath("$.data.records[0].disposalType").value("TRANSFER"));
        mockMvc.perform(get("/disposals/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(7));

        verify(disposalService).queryApplications(eq(1), eq(10), eq(DisposalType.TRANSFER),
                eq(DisposalStatus.PENDING), eq("部门"));
        verify(disposalService).getApplicationDetail(7L);
    }

    @Test
    void statisticsShouldUseDisposalService() throws Exception {
        when(disposalService.getDisposalStatistics()).thenReturn(Map.of(
                "thisMonthCount", 2L,
                "previousMonthCount", 1L,
                "pendingCount", 1L,
                "approvedCount", 1L));

        mockMvc.perform(get("/disposals/statistics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.thisMonthCount").value(2))
                .andExpect(jsonPath("$.data.pendingCount").value(1));

        verify(disposalService).getDisposalStatistics();
    }

    @Test
    void transferShouldSucceedWithValidPayload() throws Exception {
        when(disposalService.createTransferApplication(any(AssetTransferDTO.class))).thenReturn(application());

        mockMvc.perform(post("/disposals/transfer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assetId\":7,\"targetDeptId\":2,\"targetUserId\":3,\"targetLocation\":\"北京\",\"reason\":\"部门调整\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.message").value("处置申请已创建，等待审批"))
                .andExpect(jsonPath("$.data.id").value(7))
                .andExpect(jsonPath("$.data.status").value("PENDING"));

        verify(disposalService).createTransferApplication(any(AssetTransferDTO.class));
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

    private Page<DisposalApplication> applicationPage() {
        Page<DisposalApplication> page = new Page<>(1, 10);
        page.setRecords(List.of(application()));
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

    private DisposalApplication application() {
        DisposalApplication application = new DisposalApplication();
        application.setId(7L);
        application.setAssetId(7L);
        application.setDisposalType("TRANSFER");
        application.setStatus("PENDING");
        return application;
    }
}
