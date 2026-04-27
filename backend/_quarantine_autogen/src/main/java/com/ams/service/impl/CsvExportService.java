package com.ams.service.impl;

import com.ams.common.Result;
import com.ams.entity.Asset;
import com.ams.entity.DepreciationRecord;
import com.ams.service.DepreciationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

/**
 * CSV导出服务
 * 
 * 提供各类业务数据的CSV导出功能，包括资产折旧报表导出。
 * 支持直线法和双倍余额递减法两种折旧方式的数据导出。
 * 
 * @author SWARM-003 Team
 * @version 1.0
 * @since 2024-01-01
 */
@Slf4j
@Service
public class CsvExportService {

    @Autowired
    private DepreciationService depreciationService;

    /** CSV分隔符 */
    private static final String CSV_DELIMITER = ",";
    
    /** 行分隔符 */
    private static final String LINE_SEPARATOR = "\n";
    
    /** 日期格式化器 */
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    
    /** 金额格式化精度 */
    private static final int AMOUNT_PRECISION = 2;

    /**
     * 导出资产折旧报表为CSV格式
     * 
     * 支持直线法和双倍余额递减法两种折旧方式的报表导出。
     * 报表包含资产基本信息、折旧方法、各期折旧金额、累计折旧和账面价值。
     * 
     * @param assetId      资产ID
     * @param depreciationMethod 折旧方法 (straight_line / double_declining_balance)
     * @return Result<byte[]> 包含CSV字节数据的响应结果
     */
    public Result<byte[]> exportDepreciationReport(Long assetId, String depreciationMethod) {
        log.info("开始导出资产折旧报表: assetId={}, method={}", assetId, depreciationMethod);
        
        try {
            // 获取折旧记录
            List<DepreciationRecord> records = depreciationService.getDepreciationRecordsByAssetId(assetId);
            
            if (records == null || records.isEmpty()) {
                log.warn("资产 {} 没有折旧记录", assetId);
                return Result.error("该资产没有折旧记录");
            }

            // 生成CSV内容
            String csvContent = generateDepreciationReportCsv(records, depreciationMethod);
            
            // 转换为字节数组
            byte[] csvBytes = csvContent.getBytes(StandardCharsets.UTF_8);
            
            log.info("资产 {} 折旧报表导出成功，共 {} 条记录", assetId, records.size());
            return Result.success(csvBytes);
            
        } catch (Exception e) {
            log.error("导出资产 {} 折旧报表失败: {}", assetId, e.getMessage(), e);
            return Result.error("导出失败: " + e.getMessage());
        }
    }

    /**
     * 批量导出多个资产的折旧报表
     * 
     * 将多个资产的折旧数据合并为一个CSV文件，便于统一查阅和分析。
     * 
     * @param assetIds     资产ID列表
     * @param depreciationMethod 折旧方法
     * @return Result<byte[]> 包含CSV字节数据的响应结果
     */
    public Result<byte[]> exportBatchDepreciationReport(List<Long> assetIds, String depreciationMethod) {
        log.info("开始批量导出资产折旧报表: assetIds={}, method={}", assetIds, depreciationMethod);
        
        try {
            StringBuilder csvBuilder = new StringBuilder();
            
            // 添加CSV表头
            csvBuilder.append(generateDepreciationHeader());
            csvBuilder.append(LINE_SEPARATOR);
            
            // 遍历每个资产，获取其折旧记录
            for (Long assetId : assetIds) {
                List<DepreciationRecord> records = depreciationService.getDepreciationRecordsByAssetId(assetId);
                
                if (records != null && !records.isEmpty()) {
                    for (DepreciationRecord record : records) {
                        csvBuilder.append(convertDepreciationRecordToCsvRow(record));
                        csvBuilder.append(LINE_SEPARATOR);
                    }
                }
            }
            
            byte[] csvBytes = csvBuilder.toString().getBytes(StandardCharsets.UTF_8);
            
            log.info("批量导出折旧报表成功，共 {} 个资产", assetIds.size());
            return Result.success(csvBytes);
            
        } catch (Exception e) {
            log.error("批量导出折旧报表失败: {}", e.getMessage(), e);
            return Result.error("批量导出失败: " + e.getMessage());
        }
    }

    /**
     * 导出年度折旧汇总报表
     * 
     * 按资产类别聚合折旧金额，生成年度汇总报表。
     * 包含资产数量、原值总额、本期折旧、累计折旧、净值等汇总数据。
     * 
     * @param year         报表年度
     * @param categoryId   资产类别ID（可选，null表示所有类别）
     * @return Result<byte[]> 包含CSV字节数据的响应结果
     */
    public Result<byte[]> exportAnnualDepreciationReport(Integer year, Long categoryId) {
        log.info("导出年度折旧汇总报表: year={}, categoryId={}", year, categoryId);
        
        try {
            // 获取年度折旧汇总数据
            List<DepreciationRecord> records = depreciationService.getAnnualDepreciationReport(year, categoryId);
            
            String csvContent = generateAnnualReportCsv(records, year);
            byte[] csvBytes = csvContent.getBytes(StandardCharsets.UTF_8);
            
            log.info("年度折旧汇总报表导出成功: year={}", year);
            return Result.success(csvBytes);
            
        } catch (Exception e) {
            log.error("导出年度折旧汇总报表失败: {}", e.getMessage(), e);
            return Result.error("导出失败: " + e.getMessage());
        }
    }

    /**
     * 生成折旧报表CSV内容
     * 
     * @param records           折旧记录列表
     * @param depreciationMethod 折旧方法
     * @return CSV格式的字符串内容
     */
    private String generateDepreciationReportCsv(List<DepreciationRecord> records, String depreciationMethod) {
        StringBuilder csvBuilder = new StringBuilder();
        
        // 添加表头
        csvBuilder.append(generateDepreciationHeader());
        csvBuilder.append(LINE_SEPARATOR);
        
        // 添加数据行
        for (DepreciationRecord record : records) {
            csvBuilder.append(convertDepreciationRecordToCsvRow(record));
            csvBuilder.append(LINE_SEPARATOR);
        }
        
        // 添加汇总行
        csvBuilder.append(generateSummaryRow(records));
        
        return csvBuilder.toString();
    }

    /**
     * 生成折旧报表表头
     * 
     * @return CSV表头字符串
     */
    private String generateDepreciationHeader() {
        return "资产ID,资产名称,折旧方法,期间,期初账面价值,本期折旧,累计折旧,期末账面价值,备注";
    }

    /**
     * 将折旧记录转换为CSV行
     * 
     * @param record 折旧记录
     * @return CSV格式的行字符串
     */
    private String convertDepreciationRecordToCsvRow(DepreciationRecord record) {
        StringBuilder row = new StringBuilder();
        
        row.append(safeString(record.getAssetId())).append(CSV_DELIMITER);
        row.append(safeString(record.getAssetName())).append(CSV_DELIMITER);
        row.append(getMethodDisplayName(record.getDepreciationMethod())).append(CSV_DELIMITER);
        row.append(safeString(record.getPeriod())).append(CSV_DELIMITER);
        row.append(formatAmount(record.getBeginningBookValue())).append(CSV_DELIMITER);
        row.append(formatAmount(record.getDepreciationAmount())).append(CSV_DELIMITER);
        row.append(formatAmount(record.getAccumulatedDepreciation())).append(CSV_DELIMITER);
        row.append(formatAmount(record.getEndingBookValue())).append(CSV_DELIMITER);
        row.append(safeString(record.getRemark()));
        
        return row.toString();
    }

    /**
     * 生成汇总行
     * 
     * @param records 折旧记录列表
     * @return 汇总行字符串
     */
    private String generateSummaryRow(List<DepreciationRecord> records) {
        if (records == null || records.isEmpty()) {
            return "";
        }
        
        double totalDepreciation = records.stream()
                .mapToDouble(DepreciationRecord::getDepreciationAmount)
                .sum();
        
        double totalAccumulated = records.stream()
                .mapToDouble(DepreciationRecord::getAccumulatedDepreciation)
                .sum();
        
        return "汇总,,,,," + formatAmount(totalDepreciation) + "," + formatAmount(totalAccumulated) + ",";
    }

    /**
     * 生成年度汇总报表CSV
     * 
     * 按资产类别聚合数据，包含小计和总计行。
     * 
     * @param records 折旧记录列表
     * @param year    报表年度
     * @return CSV格式的字符串内容
     */
    private String generateAnnualReportCsv(List<DepreciationRecord> records, Integer year) {
        StringBuilder csvBuilder = new StringBuilder();
        
        // 添加年度汇总表头
        csvBuilder.append("报表年度,").append(year).append(LINE_SEPARATOR);
        csvBuilder.append("资产类别,资产数量,原值总额,本期折旧,累计折旧,账面净值").append(LINE_SEPARATOR);
        
        // 按类别聚合
        if (records != null && !records.isEmpty()) {
            // 按类别分组统计
            var groupedByCategory = records.stream()
                    .collect(Collectors.groupingBy(DepreciationRecord::getCategoryName));
            
            double grandTotalOriginal = 0;
            double grandTotalCurrentDepreciation = 0;
            double grandTotalAccumulated = 0;
            double grandTotalBookValue = 0;
            
            for (var entry : groupedByCategory.entrySet()) {
                String categoryName = entry.getKey();
                List<DepreciationRecord> categoryRecords = entry.getValue();
                
                double categoryOriginal = categoryRecords.stream()
                        .mapToDouble(DepreciationRecord::getOriginalValue)
                        .sum();
                double categoryCurrent = categoryRecords.stream()
                        .mapToDouble(DepreciationRecord::getDepreciationAmount)
                        .sum();
                double categoryAccumulated = categoryRecords.stream()
                        .mapToDouble(DepreciationRecord::getAccumulatedDepreciation)
                        .sum();
                double categoryBookValue = categoryRecords.stream()
                        .mapToDouble(DepreciationRecord::getEndingBookValue)
                        .sum();
                
                csvBuilder.append(safeString(categoryName)).append(CSV_DELIMITER);
                csvBuilder.append(categoryRecords.size()).append(CSV_DELIMITER);
                csvBuilder.append(formatAmount(categoryOriginal)).append(CSV_DELIMITER);
                csvBuilder.append(formatAmount(categoryCurrent)).append(CSV_DELIMITER);
                csvBuilder.append(formatAmount(categoryAccumulated)).append(CSV_DELIMITER);
                csvBuilder.append(formatAmount(categoryBookValue)).append(LINE_SEPARATOR);
                
                grandTotalOriginal += categoryOriginal;
                grandTotalCurrentDepreciation += categoryCurrent;
                grandTotalAccumulated += categoryAccumulated;
                grandTotalBookValue += categoryBookValue;
            }
            
            // 添加总计行
            csvBuilder.append("总计,,,,,").append(LINE_SEPARATOR);
            csvBuilder.append(",").append(records.size()).append(CSV_DELIMITER);
            csvBuilder.append(formatAmount(grandTotalOriginal)).append(CSV_DELIMITER);
            csvBuilder.append(formatAmount(grandTotalCurrentDepreciation)).append(CSV_DELIMITER);
            csvBuilder.append(formatAmount(grandTotalAccumulated)).append(CSV_DELIMITER);
            csvBuilder.append(formatAmount(grandTotalBookValue));
        }
        
        return csvBuilder.toString();
    }

    /**
     * 获取折旧方法显示名称
     * 
     * @param method 折旧方法代码
     * @return 显示名称
     */
    private String getMethodDisplayName(String method) {
        if (method == null) {
            return "未知";
        }
        switch (method) {
            case "straight_line":
                return "直线法";
            case "double_declining_balance":
                return "双倍余额递减法";
            default:
                return method;
        }
    }

    /**
     * 安全转换对象为字符串
     * 
     * 处理null值，避免CSV中出现null字符串。
     * 
     * @param obj 要转换的对象
     * @return 安全的字符串，如果对象为null则返回空字符串
     */
    private String safeString(Object obj) {
        return obj == null ? "" : obj.toString();
    }

    /**
     * 格式化金额
     * 
     * 保留指定精度的小数位数。
     * 
     * @param amount 金额数值
     * @return 格式化后的字符串
     */
    private String formatAmount(Double amount) {
        if (amount == null) {
            return "0.00";
        }
        return String.format("%.2f", amount);
    }
}