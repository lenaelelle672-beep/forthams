package com.ams.service.impl;

import com.ams.entity.Asset;
import com.ams.entity.DepreciationRecord;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.DepreciationRecordMapper;
import com.ams.service.impl.DepreciationCalculator;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Excel 解析服务 - SWARM-003 资产折旧计算模块
 *
 * 功能说明：
 * 1. 解析资产导入 Excel 文件，提取资产主数据
 * 2. 支持批量导入资产信息（包括折旧相关字段）
 * 3. 与 DepreciationCalculator 集成，支持直线法和双倍余额递减法
 * 4. 生成折旧记录并持久化到 depreciation_records 表
 *
 * Excel 文件格式要求：
 * - 第1行：表头（资产名称、购置日期、原值、使用年限、残值、折旧方法）
 * - 第2行起：数据行
 *
 * 折旧方法枚举值：
 * - straight_line: 直线法
 * - double_declining_balance: 双倍余额递减法
 *
 * @since SWARM-003 Phase 2
 * @author AMS Team
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExcelParserService {

    private final AssetMapper assetMapper;
    private final DepreciationRecordMapper depreciationRecordMapper;
    private final DepreciationCalculator depreciationCalculator;

    /** Excel 日期格式 */
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /** 表头索引映射 */
    private static final Map<String, Integer> HEADER_INDEX_MAP = new HashMap<>();

    static {
        HEADER_INDEX_MAP.put("资产名称", 0);
        HEADER_INDEX_MAP.put("购置日期", 1);
        HEADER_INDEX_MAP.put("原值", 2);
        HEADER_INDEX_MAP.put("使用年限", 3);
        HEADER_INDEX_MAP.put("残值", 4);
        HEADER_INDEX_MAP.put("折旧方法", 5);
    }

    /**
     * 解析 Excel 文件并导入资产数据
     *
     * 功能描述：
     * 1. 读取上传的 Excel 文件
     * 2. 解析每一行资产数据
     * 3. 调用 DepreciationCalculator 计算折旧
     * 4. 生成折旧计划表并持久化
     *
     * @param file 上传的 Excel 文件 (MultipartFile)
     * @return 导入结果，包含成功条数和失败条数
     * @throws IOException 当文件读取失败时抛出
     * @throws IllegalArgumentException 当 Excel 格式不正确时抛出
     *
     * @since SWARM-003 Phase 2
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> parseAndImportAssets(MultipartFile file) throws IOException {
        log.info("开始解析 Excel 文件: {}", file.getOriginalFilename());

        Map<String, Object> result = new HashMap<>();
        List<String> errors = new ArrayList<>();
        int successCount = 0;
        int failCount = 0;

        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            int lastRowNum = sheet.getLastRowNum();

            // 跳过表头，从第2行开始解析
            for (int rowNum = 1; rowNum <= lastRowNum; rowNum++) {
                Row row = sheet.getRow(rowNum);
                if (row == null) {
                    continue;
                }

                try {
                    // 解析并保存资产
                    Asset asset = parseAssetRow(row, rowNum);
                    assetMapper.insert(asset);

                    // 计算折旧并生成记录
                    generateDepreciationRecords(asset);

                    successCount++;
                    log.debug("成功导入资产: {}", asset.getAssetName());
                } catch (Exception e) {
                    failCount++;
                    String errorMsg = String.format("第%d行解析失败: %s", rowNum + 1, e.getMessage());
                    errors.add(errorMsg);
                    log.error(errorMsg, e);
                }
            }
        }

        result.put("successCount", successCount);
        result.put("failCount", failCount);
        result.put("errors", errors);
        log.info("Excel 导入完成: 成功{}条, 失败{}条", successCount, failCount);

        return result;
    }

    /**
     * 解析单行资产数据
     *
     * @param row Excel 行对象
     * @param rowNum 行号（用于错误提示）
     * @return 解析后的 Asset 实体
     * @throws IllegalArgumentException 当数据格式不正确时抛出
     *
     * @since SWARM-003 Phase 2
     */
    private Asset parseAssetRow(Row row, int rowNum) {
        Asset asset = new Asset();

        // 解析资产名称
        String assetName = getCellValueAsString(row.getCell(HEADER_INDEX_MAP.get("资产名称")));
        if (assetName == null || assetName.trim().isEmpty()) {
            throw new IllegalArgumentException("资产名称不能为空");
        }
        asset.setAssetName(assetName);

        // 解析购置日期
        LocalDate purchaseDate = getCellValueAsDate(row.getCell(HEADER_INDEX_MAP.get("购置日期")));
        asset.setPurchaseDate(java.time.LocalDateTime.of(purchaseDate, java.time.LocalTime.MIDNIGHT));

        // 解析原值
        BigDecimal originalValue = getCellValueAsBigDecimal(row.getCell(HEADER_INDEX_MAP.get("原值")));
        if (originalValue == null || originalValue.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("原值必须大于0");
        }
        asset.setOriginalValue(originalValue);

        // 解析使用年限
        Integer usefulLife = getCellValueAsInteger(row.getCell(HEADER_INDEX_MAP.get("使用年限")));
        if (usefulLife == null || usefulLife < 1 || usefulLife > 50) {
            throw new IllegalArgumentException("使用年限必须在1-50年之间");
        }
        asset.setUsefulLifeYears(usefulLife);

        // 解析残值（默认5%）
        BigDecimal salvageValue = getCellValueAsBigDecimal(row.getCell(HEADER_INDEX_MAP.get("残值")));
        if (salvageValue == null) {
            salvageValue = originalValue.multiply(BigDecimal.valueOf(0.05));
        }
        if (salvageValue.compareTo(BigDecimal.ZERO) < 0 || salvageValue.compareTo(originalValue) >= 0) {
            throw new IllegalArgumentException("残值必须大于等于0且小于原值");
        }
        asset.setSalvageValue(salvageValue);

        // 解析折旧方法
        String depreciationMethod = getCellValueAsString(row.getCell(HEADER_INDEX_MAP.get("折旧方法")));
        if (depreciationMethod == null || depreciationMethod.trim().isEmpty()) {
            depreciationMethod = "straight_line"; // 默认直线法
        }
        asset.setDepreciationMethod(depreciationMethod);

        return asset;
    }

    /**
     * 生成折旧记录
     *
     * 功能说明：
     * 1. 根据资产的折旧方法（直线法/双倍余额递减法）
     * 2. 调用 DepreciationCalculator 计算月度折旧计划
     * 3. 生成 DepreciationRecord 并持久化
     *
     * @param asset 资产实体
     *
     * @since SWARM-003 Phase 2
     */
    private void generateDepreciationRecords(Asset asset) {
        log.debug("为资产[{}]生成折旧记录, 折旧方法: {}", asset.getAssetName(), asset.getDepreciationMethod());

        // 调用折旧计算器生成月度折旧计划
        List<Map<String, Object>> schedule = depreciationCalculator.calculateMonthlySchedule(
            asset.getOriginalValue(),
            asset.getUsefulLifeYears(),
            asset.getSalvageValue(),
            asset.getDepreciationMethod()
        );

        // 生成折旧记录并持久化
        for (Map<String, Object> period : schedule) {
            DepreciationRecord record = new DepreciationRecord();
            record.setAssetId(asset.getId());
            record.setPeriodYear((Integer) period.get("year"));
            record.setPeriodMonth((Integer) period.get("month"));
            record.setDepreciationAmount((BigDecimal) period.get("depreciation"));
            record.setBookValue((BigDecimal) period.get("bookValue"));
            record.setAccumulatedDepreciation((BigDecimal) period.get("accumulatedDepreciation"));
            record.setDepreciationMethod(asset.getDepreciationMethod());

            depreciationRecordMapper.insert(record);
        }

        log.debug("资产[{}]折旧记录生成完成, 共{}条", asset.getAssetName(), schedule.size());
    }

    /**
     * 获取单元格值作为字符串
     *
     * @param cell 单元格对象
     * @return 字符串值
     *
     * @since SWARM-003 Phase 2
     */
    private String getCellValueAsString(Cell cell) {
        if (cell == null) {
            return null;
        }
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue().trim();
            case NUMERIC:
                return String.valueOf((long) cell.getNumericCellValue());
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            default:
                return null;
        }
    }

    /**
     * 获取单元格值作为日期
     *
     * @param cell 单元格对象
     * @return 日期对象
     * @throws IllegalArgumentException 当日期格式不正确时抛出
     *
     * @since SWARM-003 Phase 2
     */
    private LocalDate getCellValueAsDate(Cell cell) {
        if (cell == null) {
            throw new IllegalArgumentException("日期不能为空");
        }
        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            return cell.getDateCellValue().toInstant()
                .atZone(java.time.ZoneId.systemDefault())
                .toLocalDate();
        }
        String dateStr = getCellValueAsString(cell);
        if (dateStr != null) {
            return LocalDate.parse(dateStr, DATE_FORMATTER);
        }
        throw new IllegalArgumentException("日期格式不正确，应为 yyyy-MM-dd");
    }

    /**
     * 获取单元格值作为 BigDecimal
     *
     * @param cell 单元格对象
     * @return BigDecimal 值
     *
     * @since SWARM-003 Phase 2
     */
    private BigDecimal getCellValueAsBigDecimal(Cell cell) {
        if (cell == null) {
            return null;
        }
        switch (cell.getCellType()) {
            case NUMERIC:
                return BigDecimal.valueOf(cell.getNumericCellValue());
            case STRING:
                String value = cell.getStringCellValue().trim();
                return value.isEmpty() ? null : new BigDecimal(value);
            default:
                return null;
        }
    }

    /**
     * 获取单元格值作为整数
     *
     * @param cell 单元格对象
     * @return 整数值
     *
     * @since SWARM-003 Phase 2
     */
    private Integer getCellValueAsInteger(Cell cell) {
        if (cell == null) {
            return null;
        }
        switch (cell.getCellType()) {
            case NUMERIC:
                return (int) cell.getNumericCellValue();
            case STRING:
                String value = cell.getStringCellValue().trim();
                return value.isEmpty() ? null : Integer.parseInt(value);
            default:
                return null;
        }
    }

    /**
     * 查询资产的折旧记录
     *
     * @param assetId 资产ID
     * @return 折旧记录列表
     *
     * @since SWARM-003 Phase 2
     */
    public List<DepreciationRecord> getDepreciationRecordsByAssetId(Long assetId) {
        LambdaQueryWrapper<DepreciationRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(DepreciationRecord::getAssetId, assetId)
               .orderByAsc(DepreciationRecord::getPeriodYear, DepreciationRecord::getPeriodMonth);
        return depreciationRecordMapper.selectList(wrapper);
    }

    /**
     * 验证 Excel 文件格式
     *
     * @param file 上传的 Excel 文件
     * @return 验证结果
     * @throws IOException 当文件读取失败时抛出
     *
     * @since SWARM-003 Phase 2
     */
    public boolean validateExcelFormat(MultipartFile file) throws IOException {
        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            if (sheet.getLastRowNum() < 1) {
                return false;
            }

            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                return false;
            }

            // 验证必需列是否存在
            for (String header : HEADER_INDEX_MAP.keySet()) {
                boolean found = false;
                for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                    Cell cell = headerRow.getCell(i);
                    if (cell != null && header.equals(getCellValueAsString(cell))) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    log.warn("缺少必需列: {}", header);
                    return false;
                }
            }
            return true;
        }
    }
}