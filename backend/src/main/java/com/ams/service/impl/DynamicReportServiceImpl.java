package com.ams.service.impl;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.CategoryReportDTO;
import com.ams.dto.ReportMonthlyDTO;
import com.ams.dto.ReportSummaryDTO;
import com.ams.dto.ReportTrendDTO;
import com.ams.entity.Asset;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.ams.entity.SavedReport;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.SavedReportMapper;
import com.ams.service.DynamicReportService;
import com.ams.service.ReportService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.json.JsonMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DynamicReportServiceImpl implements DynamicReportService {

    private static final JsonMapper JSON_MAPPER = JsonMapper.builder().build();
    private static final List<String> DEFAULT_ASSET_FIELDS = List.of(
            "assetCode", "assetName", "categoryName", "status",
            "originalValue", "currentValue", "purchaseDate", "locationName", "departmentName"
    );

    private final SavedReportMapper savedReportMapper;
    private final AssetMapper assetMapper;
    private final ReportService reportService;

    @Override
    public Page<SavedReport> list(String reportType, String keyword, Integer pageNum, Integer pageSize) {
        String tenantId = TenantContext.requireTenantId();
        Page<SavedReport> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<SavedReport> wrapper = new LambdaQueryWrapper<SavedReport>()
                .eq(SavedReport::getTenantId, tenantId);
        if (reportType != null && !reportType.isEmpty()) {
            wrapper.eq(SavedReport::getReportType, reportType);
        }
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(SavedReport::getReportName, keyword);
        }
        wrapper.orderByDesc(SavedReport::getCreateTime);
        return savedReportMapper.selectPage(page, wrapper);
    }

    @Override
    public SavedReport getById(Long id) {
        String tenantId = TenantContext.requireTenantId();
        return savedReportMapper.selectOne(new LambdaQueryWrapper<SavedReport>()
                .eq(SavedReport::getId, id)
                .eq(SavedReport::getTenantId, tenantId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SavedReport create(SavedReport report) {
        String tenantId = TenantContext.requireTenantId();
        report.setTenantId(tenantId);
        savedReportMapper.insert(report);
        return report;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SavedReport update(Long id, SavedReport report) {
        String tenantId = TenantContext.requireTenantId();
        report.setId(id);
        report.setTenantId(tenantId);
        savedReportMapper.updateById(report);
        return getById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        String tenantId = TenantContext.requireTenantId();
        savedReportMapper.delete(new LambdaQueryWrapper<SavedReport>()
                .eq(SavedReport::getId, id)
                .eq(SavedReport::getTenantId, tenantId));
    }

    @Override
    public List<Map<String, Object>> executeReport(Long savedReportId) {
        SavedReport report = getById(savedReportId);
        if (report == null) throw new IllegalArgumentException("SavedReport not found: " + savedReportId);

        // 解析 configJson
        Map<String, Object> config;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = JSON_MAPPER.readValue(report.getConfigJson(), Map.class);
            config = parsed;
        } catch (JsonProcessingException e) {
            throw new BusinessException(500, "INVALID_REPORT_CONFIG", "Invalid configJson: " + e.getMessage(), e);
        }

        String reportType = report.getReportType();
        return switch (normalizeReportType(reportType)) {
            case "ASSET" -> buildAssetRows(config);
            case "FINANCIAL" -> monthlyRows(reportService.getDepreciationStats(), "depreciationAmount");
            case "MAINTENANCE" -> monthlyRows(reportService.getMaintenanceStats(), "maintenanceCount");
            case "INVENTORY" -> categoryRows(reportService.getByCategory());
            case "ASSET_SUMMARY", "SUMMARY" -> List.of(summaryRow(reportService.getSummary()));
            case "ASSET_CATEGORY", "CATEGORY" -> categoryRows(reportService.getByCategory());
            case "ASSET_TREND", "TREND" -> trendRows(reportService.getTrend());
            default -> throw new BusinessException(400, "UNSUPPORTED_REPORT_TYPE",
                    "Unsupported reportType: " + reportType, null);
        };
    }

    private String normalizeReportType(String reportType) {
        return reportType == null ? "" : reportType.trim().replace('-', '_').toUpperCase(Locale.ROOT);
    }

    private List<Map<String, Object>> buildAssetRows(Map<String, Object> config) {
        String tenantId = TenantContext.requireTenantId();
        List<String> selectedFields = selectedFieldNames(config);
        List<Asset> assets = assetMapper.selectList(new QueryWrapper<Asset>()
                .eq("tenant_id", tenantId)
                .orderByDesc("create_time")
                .last("LIMIT 100"));

        return assets.stream()
                .map(asset -> filterFields(assetRow(asset), selectedFields))
                .collect(Collectors.toList());
    }

    private List<String> selectedFieldNames(Map<String, Object> config) {
        Object fieldsValue = config.get("fields");
        if (!(fieldsValue instanceof List<?> fields)) {
            return DEFAULT_ASSET_FIELDS;
        }

        List<String> selected = fields.stream()
                .filter(Map.class::isInstance)
                .map(field -> (Map<?, ?>) field)
                .filter(field -> !Boolean.FALSE.equals(field.get("selected")))
                .map(field -> field.get("name"))
                .filter(String.class::isInstance)
                .map(String.class::cast)
                .filter(name -> !name.isBlank())
                .toList();

        return selected.isEmpty() ? DEFAULT_ASSET_FIELDS : selected;
    }

    private Map<String, Object> assetRow(Asset asset) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("assetCode", asset.getAssetNo());
        row.put("assetName", asset.getAssetName());
        row.put("categoryName", asset.getCategoryId());
        row.put("status", asset.getStatus());
        row.put("originalValue", asset.getOriginalValue());
        row.put("currentValue", asset.getCurrentValue());
        row.put("purchaseDate", asset.getPurchaseDate());
        row.put("locationName", asset.getLocationName() != null ? asset.getLocationName() : asset.getLocation());
        row.put("departmentName", asset.getDeptId());
        return row;
    }

    private Map<String, Object> filterFields(Map<String, Object> row, List<String> selectedFields) {
        Map<String, Object> filtered = new LinkedHashMap<>();
        for (String field : selectedFields) {
            if (row.containsKey(field)) {
                filtered.put(field, row.get(field));
            }
        }
        return filtered;
    }

    private Map<String, Object> summaryRow(ReportSummaryDTO summary) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("totalAssets", summary.getTotalAssets());
        row.put("activeAssets", summary.getActiveAssets());
        row.put("pendingApproval", summary.getPendingApproval());
        row.put("recentlyRetired", summary.getRecentlyRetired());
        return row;
    }

    private List<Map<String, Object>> categoryRows(List<CategoryReportDTO> reports) {
        return reports.stream()
                .map(report -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("categoryName", report.getCategoryName());
                    row.put("assetCount", report.getAssetCount());
                    row.put("totalValue", report.getTotalValue());
                    return row;
                })
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> trendRows(List<ReportTrendDTO> reports) {
        return reports.stream()
                .map(report -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("month", report.getMonth());
                    row.put("totalValue", report.getTotalValue());
                    row.put("netValue", report.getNetValue());
                    return row;
                })
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> monthlyRows(List<ReportMonthlyDTO> reports, String valueKey) {
        return reports.stream()
                .map(report -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("month", report.getMonth());
                    row.put(valueKey, report.getValue());
                    return row;
                })
                .collect(Collectors.toList());
    }
}
