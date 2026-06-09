package com.ams.service.impl;

import com.ams.context.TenantContext;
import com.ams.dto.ReportMonthlyDTO;
import com.ams.entity.Asset;
import com.ams.entity.SavedReport;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.SavedReportMapper;
import com.ams.service.ReportService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DynamicReportServiceImplTest {

    @Mock
    private SavedReportMapper savedReportMapper;

    @Mock
    private AssetMapper assetMapper;

    @Mock
    private ReportService reportService;

    private DynamicReportServiceImpl service;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId("dept:1");
        service = new DynamicReportServiceImpl(savedReportMapper, assetMapper, reportService);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldExecuteAssetReportWithSelectedRealAssetFields() {
        SavedReport report = report("ASSET", """
                {"fields":[
                  {"name":"assetCode","selected":true},
                  {"name":"currentValue","selected":true},
                  {"name":"status","selected":false}
                ]}
                """);
        Asset asset = new Asset();
        asset.setAssetNo("AST-001");
        asset.setAssetName("核心服务器");
        asset.setStatus("IN_USE");
        asset.setCurrentValue(new BigDecimal("12000.50"));
        asset.setPurchaseDate(LocalDate.of(2026, 1, 2));

        when(savedReportMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(report);
        when(assetMapper.selectList(any(QueryWrapper.class))).thenReturn(List.of(asset));

        List<Map<String, Object>> rows = service.executeReport(7L);

        assertEquals(1, rows.size());
        assertEquals("AST-001", rows.get(0).get("assetCode"));
        assertEquals(new BigDecimal("12000.50"), rows.get(0).get("currentValue"));
        assertFalse(rows.get(0).containsKey("status"));
        assertFalse(rows.get(0).containsKey("totalCount"));
        verify(reportService, never()).getSummary();
    }

    @Test
    void shouldExecuteFinancialReportFromRealReportServiceData() {
        SavedReport report = report("FINANCIAL", "{\"fields\":[]}");
        when(savedReportMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(report);
        when(reportService.getDepreciationStats()).thenReturn(List.of(
                ReportMonthlyDTO.builder().month("6月").value(3000.25).build()
        ));

        List<Map<String, Object>> rows = service.executeReport(8L);

        assertEquals(1, rows.size());
        assertEquals("6月", rows.get(0).get("month"));
        assertEquals(3000.25, rows.get(0).get("depreciationAmount"));
        assertFalse(rows.get(0).containsKey("totalCount"));
        verify(assetMapper, never()).selectList(any(QueryWrapper.class));
    }

    private SavedReport report(String reportType, String configJson) {
        SavedReport report = new SavedReport();
        report.setId(7L);
        report.setReportName("测试报表");
        report.setReportType(reportType);
        report.setConfigJson(configJson);
        report.setTenantId("dept:1");
        return report;
    }
}
