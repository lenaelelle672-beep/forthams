package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.AssetCreateDTO;
import com.ams.entity.Asset;
import com.ams.service.AssetService;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletResponse;
import java.io.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

/**
 * 资产批量操作控制器（SWARM-502）。
 *
 * <p>提供以下三个核心接口：
 * <ol>
 *   <li>GET  /api/assets/import/template  —— 下载资产导入模板（.xlsx）</li>
 *   <li>POST /api/assets/import           —— 上传 Excel 文件批量创建资产</li>
 *   <li>GET  /api/assets/export/csv       —— 导出资产列表为 CSV 文件</li>
 * </ol>
 *
 * <p>约束：
 * <ul>
 *   <li>导入仅接受 .xlsx，文件大小上限 10 MB，单次最多 5 000 行。</li>
 *   <li>导出 CSV 使用 UTF-8 编码（含 BOM，兼容 Excel 直接打开）。</li>
 *   <li>仅授权角色（ADMIN / ASSET_MANAGER）可调用导入/导出接口。</li>
 * </ul>
 */
@Slf4j
@RestController
@RequestMapping("/api/assets")
public class AssetBulkController {

    // ─── 常量 ────────────────────────────────────────────────────────────────

    /** 导入模板文件名（前端 Content-Disposition 校验基准）。 */
    private static final String TEMPLATE_FILENAME = "asset_import_template.xlsx";

    /** 导出 CSV 文件名。 */
    private static final String EXPORT_FILENAME = "assets_export.csv";

    /** 允许的 MIME 类型（xlsx）。 */
    private static final String XLSX_CONTENT_TYPE =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    /** 单次导入最大行数。 */
    private static final int MAX_IMPORT_ROWS = 5_000;

    /** 上传文件大小上限（10 MB）。 */
    private static final long MAX_FILE_SIZE_BYTES = 10L * 1024 * 1024;

    /**
     * 导入模板列头定义（顺序必须与实际读取逻辑保持一致）。
     * 索引：0=资产名称, 1=资产编号, 2=分类, 3=状态, 4=采购价格,
     *       5=采购日期, 6=部门, 7=位置, 8=供应商, 9=备注
     */
    private static final String[] TEMPLATE_HEADERS = {
            "资产名称*", "资产编号*", "资产分类*", "资产状态*",
            "采购价格", "采购日期(yyyy-MM-dd)", "所属部门", "存放位置", "供应商", "备注"
    };

    /** 必填列索引集合（与 TEMPLATE_HEADERS 对应）。 */
    private static final Set<Integer> REQUIRED_COLUMN_INDICES = Set.of(0, 1, 2, 3);

    /** CSV 导出列头。 */
    private static final String[] CSV_HEADERS = {
            "ID", "资产名称", "资产编号", "资产分类", "资产状态",
            "采购价格", "采购日期", "所属部门", "存放位置", "供应商", "备注", "创建时间"
    };

    // ─── 依赖 ────────────────────────────────────────────────────────────────

    @Autowired
    private AssetService assetService;

    // ─── 接口：下载导入模板 ──────────────────────────────────────────────────

    /**
     * 下载资产导入模板（GET /api/assets/import/template）。
     *
     * <p>优先从 classpath:templates/asset_import_template.xlsx 读取预制模板；
     * 若文件不存在则动态生成包含预定义列头与示例行的 xlsx 文件。
     *
     * @return 包含 .xlsx 文件字节的响应实体，HTTP 200
     */
    @GetMapping("/import/template")
    @PreAuthorize("hasAnyRole('ADMIN', 'ASSET_MANAGER', 'USER')")
    public ResponseEntity<ByteArrayResource> downloadTemplate() {
        log.info("[AssetBulk] 请求下载导入模板");
        try {
            byte[] templateBytes = loadOrGenerateTemplate();
            ByteArrayResource resource = new ByteArrayResource(templateBytes);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + TEMPLATE_FILENAME + "\"; "
                            + "filename*=UTF-8''" + TEMPLATE_FILENAME)
                    .contentType(MediaType.parseMediaType(XLSX_CONTENT_TYPE))
                    .contentLength(templateBytes.length)
                    .body(resource);
        } catch (IOException e) {
            log.error("[AssetBulk] 生成导入模板失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // ─── 接口：批量导入 ──────────────────────────────────────────────────────

    /**
     * 上传 Excel 文件批量创建资产（POST /api/assets/import）。
     *
     * <p>校验流程：
     * <ol>
     *   <li>文件类型与大小校验（Content-Type + 魔数验证）。</li>
     *   <li>行数上限校验（≤ 5 000 行，含表头行不计）。</li>
     *   <li>逐行必填字段 + 格式校验；收集所有错误后统一返回 400。</li>
     *   <li>通过校验后批量插入，返回 201 及导入统计。</li>
     * </ol>
     *
     * @param file 用户上传的 .xlsx 文件（multipart/form-data）
     * @return 导入结果：成功行数、跳过行数、错误明细（含行号与字段）
     */
    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN', 'ASSET_MANAGER')")
    public ResponseEntity<Result<Map<String, Object>>> importAssets(
            @RequestParam("file") MultipartFile file) {

        log.info("[AssetBulk] 收到批量导入请求，文件名={}，大小={} bytes",
                file.getOriginalFilename(), file.getSize());

        // ── 1. 文件基础校验 ─────────────────────────────────────────────────
        ResponseEntity<Result<Map<String, Object>>> validationError =
                validateUploadedFile(file);
        if (validationError != null) {
            return validationError;
        }

        // ── 2. 解析 Excel ───────────────────────────────────────────────────
        List<Map<String, Object>> parsedRows;
        List<Map<String, Object>> errors = new ArrayList<>();
        try (InputStream is = file.getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            int totalRows = sheet.getLastRowNum(); // 不含表头则为行数

            // 行数上限（超出 5000 数据行返回 413）
            if (totalRows > MAX_IMPORT_ROWS) {
                log.warn("[AssetBulk] 导入行数 {} 超出上限 {}", totalRows, MAX_IMPORT_ROWS);
                Map<String, Object> body = buildErrorBody(
                        "导入行数超出上限，最多允许 " + MAX_IMPORT_ROWS + " 行，当前为 " + totalRows + " 行",
                        Collections.emptyList());
                return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                        .body(Result.error(413, body.toString()));
            }

            parsedRows = parseSheet(sheet, errors);

        } catch (IOException | org.apache.poi.openxml4j.exceptions.InvalidFormatException e) {
            log.error("[AssetBulk] 解析 Excel 失败", e);
            return ResponseEntity.badRequest()
                    .body(Result.error(400, "Excel 文件解析失败：" + e.getMessage()));
        } catch (Exception e) {
            log.error("[AssetBulk] 导入处理异常", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Result.error(500, "服务器内部错误"));
        }

        // ── 3. 存在校验错误时返回 400 ────────────────────────────────────────
        if (!errors.isEmpty()) {
            log.warn("[AssetBulk] 数据校验失败，错误数={}", errors.size());
            Map<String, Object> errorBody = buildErrorBody("数据校验失败，请修正后重新上传", errors);
            return ResponseEntity.badRequest().body(Result.error(400, errorBody.toString()));
        }

        // ── 4. 批量插入 ─────────────────────────────────────────────────────
        int successCount = 0;
        int skipCount = 0;
        List<Map<String, Object>> importErrors = new ArrayList<>();

        for (Map<String, Object> row : parsedRows) {
            try {
                AssetCreateDTO dto = mapRowToDTO(row);
                assetService.createAsset(dto);
                successCount++;
            } catch (Exception e) {
                log.warn("[AssetBulk] 第 {} 行插入失败: {}", row.get("__rowNum__"), e.getMessage());
                Map<String, Object> err = new LinkedHashMap<>();
                err.put("row", row.get("__rowNum__"));
                err.put("message", e.getMessage());
                importErrors.add(err);
                skipCount++;
            }
        }

        // ── 5. 构造响应 ─────────────────────────────────────────────────────
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalRows", parsedRows.size());
        result.put("successCount", successCount);
        result.put("skipCount", skipCount);
        if (!importErrors.isEmpty()) {
            result.put("errors", importErrors);
        }

        log.info("[AssetBulk] 批量导入完成，成功={}, 跳过={}", successCount, skipCount);
        return ResponseEntity.status(HttpStatus.CREATED).body(Result.success(result));
    }

    // ─── 接口：导出 CSV ──────────────────────────────────────────────────────

    /**
     * 导出资产列表为 CSV 文件（GET /api/assets/export/csv）。
     *
     * <p>以 UTF-8 + BOM 编码生成 CSV，保证在 Windows Excel 中直接打开不出现乱码。
     * 目标响应时间 ≤ 5 秒（10k 行以内）。
     *
     * @param response HttpServletResponse，直接写入输出流以避免大文件内存积压
     */
    @GetMapping("/export/csv")
    @PreAuthorize("hasAnyRole('ADMIN', 'ASSET_MANAGER')")
    public void exportCsv(HttpServletResponse response) {
        log.info("[AssetBulk] 收到 CSV 导出请求");

        response.setContentType("text/csv; charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + EXPORT_FILENAME + "\"; "
                + "filename*=UTF-8''" + EXPORT_FILENAME);

        try (PrintWriter writer = new PrintWriter(
                new OutputStreamWriter(response.getOutputStream(), StandardCharsets.UTF_8))) {

            // UTF-8 BOM（使 Excel 正确识别编码）
            writer.print('\uFEFF');

            // 写列头
            writer.println(escapeCsvRow(CSV_HEADERS));

            // 查询全量资产
            List<Asset> assets = assetService.listAllAssets();
            for (Asset asset : assets) {
                writer.println(escapeCsvRow(assetToCsvRow(asset)));
            }

            writer.flush();
            log.info("[AssetBulk] CSV 导出完成，共 {} 条资产记录", assets.size());

        } catch (IOException e) {
            log.error("[AssetBulk] CSV 导出写入失败", e);
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    // ─── 私有辅助方法 ────────────────────────────────────────────────────────

    /**
     * 校验上传文件的类型与大小。
     *
     * @param file 上传文件
     * @return 若校验失败返回错误响应；通过则返回 null
     */
    private ResponseEntity<Result<Map<String, Object>>> validateUploadedFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Result.error(400, "上传文件不能为空"));
        }

        // 大小校验
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body(Result.error(413, "文件大小超出限制（最大 10 MB）"));
        }

        // MIME 类型校验
        String contentType = file.getContentType();
        String originalName = file.getOriginalFilename();
        boolean mimeOk = XLSX_CONTENT_TYPE.equalsIgnoreCase(contentType)
                || "application/octet-stream".equalsIgnoreCase(contentType);
        boolean nameOk = originalName != null
                && originalName.toLowerCase(Locale.ROOT).endsWith(".xlsx");

        if (!mimeOk && !nameOk) {
            return ResponseEntity.badRequest()
                    .body(Result.error(400, "仅支持 .xlsx 格式文件，实际类型: " + contentType));
        }

        // 魔数（文件头）校验：xlsx 实为 ZIP 格式，前 4 字节为 PK\x03\x04
        try (InputStream is = file.getInputStream()) {
            byte[] header = new byte[4];
            int read = is.read(header);
            if (read < 4
                    || header[0] != 0x50 || header[1] != 0x4B
                    || header[2] != 0x03 || header[3] != 0x04) {
                return ResponseEntity.badRequest()
                        .body(Result.error(400, "文件内容不合法，未通过安全扫描"));
            }
        } catch (IOException e) {
            return ResponseEntity.badRequest()
                    .body(Result.error(400, "文件读取失败：" + e.getMessage()));
        }

        return null; // 通过
    }

    /**
     * 解析 Excel Sheet，返回每行的字段映射，并将校验错误追加到 errors 列表。
     *
     * <p>第 0 行视为表头（跳过），从第 1 行开始解析数据行。
     *
     * @param sheet  待解析的 Sheet
     * @param errors 错误收集列表，每个元素包含 row/field/message
     * @return 解析成功的行数据列表（包含 __rowNum__ 内部字段）
     */
    private List<Map<String, Object>> parseSheet(Sheet sheet, List<Map<String, Object>> errors) {
        List<Map<String, Object>> rows = new ArrayList<>();
        DataFormatter formatter = new DataFormatter();

        for (int rowIdx = 1; rowIdx <= sheet.getLastRowNum(); rowIdx++) {
            Row row = sheet.getRow(rowIdx);
            if (row == null || isRowBlank(row)) {
                continue; // 跳过空行
            }

            Map<String, Object> rowData = new LinkedHashMap<>();
            rowData.put("__rowNum__", rowIdx + 1); // 用户可见行号（含表头为第1行）

            // 读取各列
            String assetName    = getCellValue(row, 0, formatter);
            String assetCode    = getCellValue(row, 1, formatter);
            String category     = getCellValue(row, 2, formatter);
            String status       = getCellValue(row, 3, formatter);
            String priceStr     = getCellValue(row, 4, formatter);
            String purchaseDate = getCellValue(row, 5, formatter);
            String dept         = getCellValue(row, 6, formatter);
            String location     = getCellValue(row, 7, formatter);
            String vendor       = getCellValue(row, 8, formatter);
            String remark       = getCellValue(row, 9, formatter);

            // 必填字段校验
            validateRequired(rowIdx + 1, "资产名称", assetName, errors);
            validateRequired(rowIdx + 1, "资产编号", assetCode, errors);
            validateRequired(rowIdx + 1, "资产分类", category, errors);
            validateRequired(rowIdx + 1, "资产状态", status, errors);

            // 采购价格格式校验
            BigDecimal price = null;
            if (priceStr != null && !priceStr.isBlank()) {
                try {
                    price = new BigDecimal(priceStr.trim());
                    if (price.compareTo(BigDecimal.ZERO) < 0) {
                        addError(errors, rowIdx + 1, "采购价格", "价格不能为负数");
                    }
                } catch (NumberFormatException e) {
                    addError(errors, rowIdx + 1, "采购价格", "价格格式不合法，当前值: " + priceStr);
                }
            }

            // 采购日期格式校验
            LocalDate parsedDate = null;
            if (purchaseDate != null && !purchaseDate.isBlank()) {
                try {
                    parsedDate = LocalDate.parse(purchaseDate.trim(),
                            DateTimeFormatter.ofPattern("yyyy-MM-dd"));
                } catch (DateTimeParseException e) {
                    addError(errors, rowIdx + 1, "采购日期", "日期格式不合法，期望 yyyy-MM-dd，当前值: " + purchaseDate);
                }
            }

            rowData.put("assetName", assetName);
            rowData.put("assetCode", assetCode);
            rowData.put("category",  category);
            rowData.put("status",    status);
            rowData.put("price",     price);
            rowData.put("purchaseDate", parsedDate);
            rowData.put("dept",      dept);
            rowData.put("location",  location);
            rowData.put("vendor",    vendor);
            rowData.put("remark",    remark);

            rows.add(rowData);
        }

        return rows;
    }

    /**
     * 将解析行数据映射为 {@link AssetCreateDTO}。
     *
     * @param row 已通过校验的行数据
     * @return 填充完毕的 AssetCreateDTO
     */
    private AssetCreateDTO mapRowToDTO(Map<String, Object> row) {
        AssetCreateDTO dto = new AssetCreateDTO();
        dto.setName((String) row.get("assetName"));
        dto.setAssetCode((String) row.get("assetCode"));
        dto.setCategory((String) row.get("category"));
        dto.setStatus((String) row.get("status"));
        dto.setPurchasePrice((BigDecimal) row.get("price"));
        LocalDate date = (LocalDate) row.get("purchaseDate");
        if (date != null) {
            dto.setPurchaseDate(date.toString());
        }
        dto.setDeptName((String) row.get("dept"));
        dto.setLocation((String) row.get("location"));
        dto.setVendorName((String) row.get("vendor"));
        dto.setRemark((String) row.get("remark"));
        return dto;
    }

    /**
     * 将 {@link Asset} 实体转为 CSV 行数据数组。
     *
     * @param asset 资产实体
     * @return 按 CSV_HEADERS 顺序排列的字段值数组
     */
    private String[] assetToCsvRow(Asset asset) {
        return new String[]{
                nullToEmpty(asset.getId() == null ? null : asset.getId().toString()),
                nullToEmpty(asset.getName()),
                nullToEmpty(asset.getAssetCode()),
                nullToEmpty(asset.getCategory()),
                nullToEmpty(asset.getStatus()),
                asset.getPurchasePrice() == null ? "" : asset.getPurchasePrice().toPlainString(),
                nullToEmpty(asset.getPurchaseDate() == null ? null : asset.getPurchaseDate().toString()),
                nullToEmpty(asset.getDeptName()),
                nullToEmpty(asset.getLocation()),
                nullToEmpty(asset.getVendorName()),
                nullToEmpty(asset.getRemark()),
                nullToEmpty(asset.getCreateTime() == null ? null : asset.getCreateTime().toString())
        };
    }

    /**
     * 将字符串数组转义并拼接为单条 CSV 行。
     *
     * <p>对含有逗号、双引号或换行符的字段用双引号包裹，并将字段内双引号转义为两个双引号。
     *
     * @param fields 字段数组
     * @return RFC 4180 兼容的 CSV 行字符串
     */
    private String escapeCsvRow(String[] fields) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < fields.length; i++) {
            if (i > 0) sb.append(',');
            String f = fields[i] == null ? "" : fields[i];
            if (f.contains(",") || f.contains("\"") || f.contains("\n") || f.contains("\r")) {
                sb.append('"').append(f.replace("\"", "\"\"")).append('"');
            } else {
                sb.append(f);
            }
        }
        return sb.toString();
    }

    /**
     * 尝试从 classpath 加载预置模板；若不存在则动态生成。
     *
     * @return 模板文件字节数组
     * @throws IOException IO 异常
     */
    private byte[] loadOrGenerateTemplate() throws IOException {
        ClassPathResource resource = new ClassPathResource("templates/" + TEMPLATE_FILENAME);
        if (resource.exists()) {
            try (InputStream is = resource.getInputStream()) {
                return is.readAllBytes();
            }
        }
        return generateTemplateBytes();
    }

    /**
     * 动态生成包含列头与示例行的导入模板字节数组。
     *
     * @return xlsx 文件字节数组
     * @throws IOException IO 异常
     */
    private byte[] generateTemplateBytes() throws IOException {
        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet("资产导入模板");

            // ── 列头样式 ────────────────────────────────────────────────────
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.LIGHT_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // ── 列头行 ──────────────────────────────────────────────────────
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < TEMPLATE_HEADERS.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(TEMPLATE_HEADERS[i]);
                cell.setCellStyle(headerStyle);
                sheet.setColumnWidth(i, 20 * 256); // 约 20 字符宽
            }

            // ── 示例数据行 ──────────────────────────────────────────────────
            Row exampleRow = sheet.createRow(1);
            String[] example = {
                    "笔记本电脑", "IT-2024-001", "IT设备", "在用",
                    "8999.00", "2024-01-15", "研发部", "3楼机房A区", "联想", "示例数据，可删除"
            };
            for (int i = 0; i < example.length; i++) {
                exampleRow.createCell(i).setCellValue(example[i]);
            }

            workbook.write(baos);
            return baos.toByteArray();
        }
    }

    /**
     * 从 Excel 单元格读取字符串值，自动处理数值/日期/布尔等类型。
     *
     * @param row       Excel 行
     * @param colIdx    列索引
     * @param formatter DataFormatter 实例
     * @return 单元格字符串值，空白时返回 null
     */
    private String getCellValue(Row row, int colIdx, DataFormatter formatter) {
        Cell cell = row.getCell(colIdx, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return null;
        String val = formatter.formatCellValue(cell).trim();
        return val.isEmpty() ? null : val;
    }

    /**
     * 判断行是否为全空行。
     *
     * @param row Excel 行
     * @return true 表示全空
     */
    private boolean isRowBlank(Row row) {
        DataFormatter formatter = new DataFormatter();
        for (Cell cell : row) {
            String val = formatter.formatCellValue(cell).trim();
            if (!val.isEmpty()) return false;
        }
        return true;
    }

    /**
     * 校验必填字段，若为空则向 errors 列表追加错误记录。
     *
     * @param visibleRowNum 用户可见行号（含表头偏移）
     * @param fieldName     字段名称
     * @param value         字段值
     * @param errors        错误收集列表
     */
    private void validateRequired(int visibleRowNum, String fieldName,
                                   String value, List<Map<String, Object>> errors) {
        if (value == null || value.isBlank()) {
            addError(errors, visibleRowNum, fieldName, "必填字段不能为空");
        }
    }

    /**
     * 向错误列表追加一条结构化错误记录。
     *
     * @param errors        错误收集列表
     * @param visibleRowNum 用户可见行号
     * @param fieldName     字段名称
     * @param message       错误描述
     */
    private void addError(List<Map<String, Object>> errors,
                           int visibleRowNum, String fieldName, String message) {
        Map<String, Object> err = new LinkedHashMap<>();
        err.put("row",     visibleRowNum);
        err.put("field",   fieldName);
        err.put("message", message);
        errors.add(err);
    }

    /**
     * 构造批量操作错误响应体（包含摘要与明细列表）。
     *
     * @param summary 错误摘要描述
     * @param errors  错误明细列表
     * @return 结构化 Map，可直接序列化为 JSON
     */
    private Map<String, Object> buildErrorBody(String summary, List<Map<String, Object>> errors) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message",    summary);
        body.put("errorCount", errors.size());
        body.put("errors",     errors);
        return body;
    }

    /**
     * 将可能为 null 的字符串转为空字符串，用于 CSV 导出。
     *
     * @param val 原始值
     * @return 非 null 字符串
     */
    private String nullToEmpty(String val) {
        return val == null ? "" : val;
    }
}