package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.AssetCreateDTO;
import com.ams.dto.AssetHistoryEvent;
import com.ams.dto.AssetQueryDTO;
import com.ams.dto.AssetUpdateDTO;
import com.ams.entity.Asset;
import com.ams.service.AssetHistoryService;
import com.ams.service.AssetService;
import com.ams.service.DepreciationService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import com.ams.entity.SysAttachment;
import com.ams.service.AssetAttachmentService;
import org.springframework.web.multipart.MultipartFile;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

@RestController
@RequestMapping("/assets")
@RequiredArgsConstructor
@Tag(name = "资产管理", description = "资产台账 CRUD、折旧计算、附件管理")
public class AssetController {
    private final AssetService assetService;
    private final DepreciationService depreciationService;
    private final AssetAttachmentService assetAttachmentService;
    private final AssetHistoryService assetHistoryService;

    @Operation(summary = "分页查询资产列表", description = "支持多条件筛选、关键词搜索、分页排序")
    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping({"", "/list"})
    public Result<Page<Asset>> list(AssetQueryDTO queryDTO) {
        return Result.success(assetService.queryAssets(queryDTO));
    }

    @Operation(summary = "获取资产详情", description = "根据资产 ID 获取完整信息，含分类、型号、位置等关联数据")
    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping("/{id}")
    public Result<Asset> getById(@PathVariable Long id) {
        return Result.success(assetService.getAssetById(id));
    }

    @Operation(summary = "获取资产折旧计划", description = "获取指定资产的折旧明细计划表")
    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping("/{id}/depreciation-schedule")
    public Result<java.util.List<DepreciationService.DepreciationScheduleItem>> getDepreciationSchedule(
            @PathVariable Long id,
            @RequestParam(required = false) String period) {
        return Result.success(depreciationService.getScheduleByAssetId(id, period));
    }

    @Operation(summary = "获取资产完整履历", description = "聚合变更日志、工单、保养、领用、借用、检验、报废、入库等多来源事件，按时间降序")
    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping("/{id}/history")
    public Result<List<AssetHistoryEvent>> getHistory(@PathVariable Long id,
                                                      @RequestParam(required = false) List<String> eventTypes) {
        if (eventTypes != null && !eventTypes.isEmpty()) {
            return Result.success(assetHistoryService.getHistoryByTypes(id, eventTypes));
        }
        return Result.success(assetHistoryService.getFullHistory(id));
    }

    @Operation(summary = "创建资产", description = "创建新的资产台账记录")
    @PreAuthorize("@ss.hasPermi('asset:ledger:create')")
    @PostMapping
    public Result<Asset> create(@Valid @RequestBody AssetCreateDTO createDTO) {
        return Result.success(assetService.createAsset(createDTO));
    }

    @Operation(summary = "更新资产", description = "修改指定资产的属性信息")
    @PreAuthorize("@ss.hasPermi('asset:ledger:edit')")
    @PutMapping("/{id}")
    public Result<Asset> update(@PathVariable Long id, @Valid @RequestBody AssetUpdateDTO updateDTO) {
        return Result.success(assetService.updateAsset(id, updateDTO));
    }

    @Operation(summary = "删除资产", description = "根据 ID 删除资产（逻辑删除）")
    @PreAuthorize("@ss.hasPermi('asset:ledger:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        assetService.deleteAsset(id);
        return Result.success();
    }

    // ── 导入导出 ───────────────────────────────────────────────────────────

    @Operation(summary = "下载资产导入模板", description = "返回 CSV 模板，字段与导入解析接口一致")
    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping("/import/template")
    public ResponseEntity<byte[]> downloadImportTemplate() {
        String template = "\uFEFFassetNo,assetName,categoryId,status,deptId,locationId,originalValue,remark\n"
                + "AST-2026-0001,示例资产,1,IDLE,1,1,1000.00,可删除此示例行\n";
        return csvResponse("asset_import_template.csv", template);
    }

    @Operation(summary = "解析资产导入文件", description = "解析 CSV 文件并返回预览行与行级错误")
    @PreAuthorize("@ss.hasPermi('asset:ledger:create')")
    @PostMapping("/import/parse")
    public Result<Map<String, Object>> parseImportFile(@RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            return Result.error(400, "上传文件不能为空");
        }
        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        if (!filename.endsWith(".csv")) {
            return Result.error(400, "当前导入接口支持 CSV 文件，请先下载模板填写后上传");
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        List<Map<String, Object>> errors = new ArrayList<>();
        String content = new String(file.getBytes(), StandardCharsets.UTF_8).replace("\uFEFF", "");
        List<String[]> records = parseCsvRecords(content);
        if (records.isEmpty() || isBlankRecord(records.get(0))) {
            return Result.error(400, "文件缺少表头");
        }

        String[] headers = records.get(0);
        for (int i = 1; i < records.size(); i++) {
            String[] values = records.get(i);
            if (isBlankRecord(values)) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("rowNumber", i + 1);
            for (int j = 0; j < headers.length; j++) {
                String header = headers[j].trim();
                row.put(header, j < values.length ? values[j].trim() : "");
            }
            validateImportRow(row, errors);
            rows.add(row);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("parseId", "csv-" + UUID.randomUUID());
        result.put("rows", rows);
        result.put("errors", errors);
        return Result.success(result);
    }

    @Operation(summary = "提交资产导入", description = "将前端确认后的 CSV 预览行写入资产台账")
    @PreAuthorize("@ss.hasPermi('asset:ledger:create')")
    @PostMapping("/import/commit")
    public Result<Map<String, Object>> commitImport(@RequestBody Map<String, Object> payload) {
        Object rawRows = payload.get("rows");
        if (!(rawRows instanceof List<?> rows)) {
            return Result.error(400, "导入数据不能为空");
        }

        int importedCount = 0;
        List<Map<String, Object>> errors = new ArrayList<>();
        for (Object item : rows) {
            if (!(item instanceof Map<?, ?> rawRow)) {
                continue;
            }
            Map<String, Object> row = normalizeRow(rawRow);
            try {
                assetService.createAsset(toAssetCreateDTO(row));
                importedCount++;
            } catch (Exception ex) {
                Map<String, Object> error = new LinkedHashMap<>();
                error.put("rowNumber", row.getOrDefault("rowNumber", importedCount + 1));
                error.put("field", "row");
                error.put("message", ex.getMessage());
                errors.add(error);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("success", errors.isEmpty());
        result.put("importedCount", importedCount);
        result.put("failedCount", errors.size());
        result.put("errors", errors);
        return Result.success(result);
    }

    @Operation(summary = "导出资产 CSV", description = "按当前筛选条件导出资产台账 CSV")
    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @PostMapping("/export")
    public ResponseEntity<byte[]> exportAssets(@RequestBody(required = false) AssetQueryDTO queryDTO) {
        AssetQueryDTO exportQuery = queryDTO == null ? new AssetQueryDTO() : queryDTO;
        exportQuery.setPage(1);
        exportQuery.setPageSize(50000);
        List<Asset> records = assetService.queryAssets(exportQuery).getRecords();

        StringBuilder csv = new StringBuilder("\uFEFFassetNo,assetName,categoryId,status,deptId,locationId,originalValue,remark\n");
        for (Asset asset : records) {
            csv.append(csv(asset.getAssetNo())).append(',')
                    .append(csv(asset.getAssetName())).append(',')
                    .append(csv(asset.getCategoryId())).append(',')
                    .append(csv(asset.getStatus())).append(',')
                    .append(csv(asset.getDeptId())).append(',')
                    .append(csv(asset.getLocationId())).append(',')
                    .append(csv(asset.getOriginalValue())).append(',')
                    .append(csv(asset.getRemark()))
                    .append('\n');
        }
        return csvResponse("assets_export.csv", csv.toString());
    }

    // ── 附件管理 ───────────────────────────────────────────────────────────

    /**
     * 获取资产附件列表。
     */
    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping("/{id}/attachments")
    public Result<List<SysAttachment>> getAttachments(@PathVariable Long id) {
        return Result.success(assetAttachmentService.getAttachments(id));
    }

    /**
     * 上传资产附件。
     * 接收 MultipartFile，保存文件后创建附件记录。
     */
    @PreAuthorize("@ss.hasPermi('asset:attachment:upload')")
    @PostMapping("/{id}/attachments")
    public Result<SysAttachment> uploadAttachment(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        // 文件空值校验
        if (file == null || file.isEmpty()) {
            return Result.error(400, "文件不能为空");
        }
        // 文件大小限制（10MB）
        if (file.getSize() > 10 * 1024 * 1024) {
            return Result.error(400, "文件大小不能超过10MB");
        }

        try {
            String originalFilename = file.getOriginalFilename();
            String ext = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                ext = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String newFilename = UUID.randomUUID().toString() + ext;

            Path targetPath = Paths.get("./uploads", newFilename);
            Files.createDirectories(targetPath.getParent());
            file.transferTo(targetPath.toFile());

            String fileUrl = "/api/file/" + newFilename;

            SysAttachment attachment = assetAttachmentService.addAttachment(
                    id,
                    originalFilename != null ? originalFilename : newFilename,
                    fileUrl,
                    file.getSize(),
                    file.getContentType() != null ? file.getContentType() : "application/octet-stream",
                    getCurrentUserId());

            return Result.success(attachment);
        } catch (IOException e) {
            return Result.error(500, "文件上传失败: " + e.getMessage());
        }
    }

    /**
     * 删除资产附件。
     */
    @PreAuthorize("@ss.hasPermi('asset:attachment:delete')")
    @DeleteMapping("/{id}/attachments/{attachmentId}")
    public Result<Void> deleteAttachment(
            @PathVariable Long id,
            @PathVariable Long attachmentId) {
        assetAttachmentService.deleteAttachment(attachmentId);
        return Result.success();
    }

    // ── 父子关系管理 ─────────────────────────────────────────────────────────

    /**
     * 获取指定资产的直接子资产列表。
     */
    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping("/{id}/children")
    public Result<List<Asset>> getChildren(@PathVariable Long id) {
        return Result.success(assetService.getChildren(id));
    }

    /**
     * 获取指定资产的完整树形结构（递归，最多 5 层）。
     */
    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping("/{id}/tree")
    public Result<Asset> getAssetTree(@PathVariable Long id) {
        return Result.success(assetService.getAssetTree(id));
    }

    /**
     * 获取指定资产的父资产信息。
     */
    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping("/{id}/parent")
    public Result<Asset> getParent(@PathVariable Long id) {
        Asset parent = assetService.getParentAsset(id);
        return parent != null ? Result.success(parent) : Result.success("无父资产", null);
    }

    /**
     * 设置父资产关系。
     *
     * @param id          当前资产 ID
     * @param parentAssetId 要设为父资产的 ID
     * @param relationType 关系类型（可选，默认 OTHER）
     */
    @PreAuthorize("@ss.hasPermi('asset:ledger:edit')")
    @PutMapping("/{id}/parent")
    public Result<Void> setParent(
            @PathVariable Long id,
            @RequestParam Long parentAssetId,
            @RequestParam(required = false) String relationType) {
        assetService.setParentAsset(id, parentAssetId, relationType);
        return Result.success();
    }

    /**
     * 移除父资产关系。
     */
    @PreAuthorize("@ss.hasPermi('asset:ledger:edit')")
    @DeleteMapping("/{id}/parent")
    public Result<Void> removeParent(@PathVariable Long id) {
        assetService.removeParentAsset(id);
        return Result.success();
    }

    /**
     * 获取当前登录用户 ID。
     */
    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }
        Object principal = auth.getPrincipal();
        if (principal instanceof com.ams.security.LoginUser) {
            return ((com.ams.security.LoginUser) principal).getUserId();
        }
        return null;
    }

    private ResponseEntity<byte[]> csvResponse(String filename, String content) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build().toString())
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(content.getBytes(StandardCharsets.UTF_8));
    }

    private List<String[]> parseCsvRecords(String content) {
        List<String[]> records = new ArrayList<>();
        List<String> record = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean inQuotes = false;

        for (int i = 0; i < content.length(); i++) {
            char c = content.charAt(i);
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < content.length() && content.charAt(i + 1) == '"') {
                        field.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    field.append(c);
                }
                continue;
            }

            if (c == '"') {
                inQuotes = true;
            } else if (c == ',') {
                record.add(field.toString());
                field.setLength(0);
            } else if (c == '\r' || c == '\n') {
                record.add(field.toString());
                records.add(record.toArray(String[]::new));
                record = new ArrayList<>();
                field.setLength(0);
                if (c == '\r' && i + 1 < content.length() && content.charAt(i + 1) == '\n') {
                    i++;
                }
            } else {
                field.append(c);
            }
        }

        if (field.length() > 0 || !record.isEmpty() || content.endsWith(",")) {
            record.add(field.toString());
            records.add(record.toArray(String[]::new));
        }
        return records;
    }

    private boolean isBlankRecord(String[] values) {
        if (values == null || values.length == 0) {
            return true;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return false;
            }
        }
        return true;
    }

    private void validateImportRow(Map<String, Object> row, List<Map<String, Object>> errors) {
        requireImportValue(row, errors, "assetNo", "资产编号不能为空");
        requireImportValue(row, errors, "assetName", "资产名称不能为空");
    }

    private void requireImportValue(Map<String, Object> row, List<Map<String, Object>> errors, String field, String message) {
        Object value = row.get(field);
        if (value == null || value.toString().isBlank()) {
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("rowNumber", row.get("rowNumber"));
            error.put("field", field);
            error.put("message", message);
            errors.add(error);
        }
    }

    private Map<String, Object> normalizeRow(Map<?, ?> rawRow) {
        Map<String, Object> row = new LinkedHashMap<>();
        rawRow.forEach((key, value) -> {
            if (key != null) {
                row.put(key.toString(), value);
            }
        });
        return row;
    }

    private AssetCreateDTO toAssetCreateDTO(Map<String, Object> row) {
        AssetCreateDTO dto = new AssetCreateDTO();
        dto.setAssetNo(stringValue(row.get("assetNo")));
        dto.setAssetName(stringValue(row.get("assetName")));
        dto.setCategoryId(longValue(row.get("categoryId")));
        dto.setStatus(stringValue(row.get("status")));
        dto.setDeptId(longValue(row.get("deptId")));
        dto.setLocationId(longValue(row.get("locationId")));
        dto.setOriginalValue(decimalValue(row.get("originalValue")));
        dto.setRemark(stringValue(row.get("remark")));
        return dto;
    }

    private String stringValue(Object value) {
        return value == null || value.toString().isBlank() ? null : value.toString().trim();
    }

    private Long longValue(Object value) {
        String str = stringValue(value);
        return str == null ? null : Long.valueOf(str);
    }

    private BigDecimal decimalValue(Object value) {
        String str = stringValue(value);
        return str == null ? null : new BigDecimal(str);
    }

    private String csv(Object value) {
        if (value == null) {
            return "";
        }
        String text = value.toString();
        if (text.contains(",") || text.contains("\"") || text.contains("\n")) {
            return "\"" + text.replace("\"", "\"\"") + "\"";
        }
        return text;
    }

    // ── ABC 分类管理 ───────────────────────────────────────────────────────────────

    /**
     * 计算 ABC 分类（按 categoryId 分组）。
     *
     * 算法规则：
     * - 按 categoryId 分组计算
     * - 组内按 currentValue 降序排序
     * - 累计价值占比：
     *   - A 类：累计价值占比 0-80%（约占总数量 20%）
     *   - B 类：累计价值占比 80-95%（约占总数量 30%）
     *   - C 类：累计价值占比 95-100%（约占总数量 50%）
     *
     * @param categoryId 分类 ID，如果为 null 则计算所有分类
     * @return 更新后的资产列表
     */
    @Operation(summary = "计算 ABC 分类", description = "按 categoryId 分组计算 ABC 分类，返回更新后的资产列表")
    @PreAuthorize("@ss.hasPermi('asset:ledger:edit')")
    @PostMapping("/abc-classification/calculate")
    public Result<List<Asset>> calculateABCClassification(
            @RequestParam(required = false) Long categoryId) {
        return Result.success(assetService.calculateABCClassification(categoryId));
    }
}
