package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.SafetyChecklistBatchResult;
import com.ams.entity.SysAttachment;
import com.ams.entity.SafetyChecklistExecution;
import com.ams.entity.SafetyChecklistItem;
import com.ams.entity.SafetyChecklistResult;
import com.ams.entity.SafetyChecklistTemplate;
import com.ams.service.SafetyChecklistAttachmentService;
import com.ams.service.SafetyChecklistService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/safety-checklists")
@RequiredArgsConstructor
public class SafetyChecklistController {
    private final SafetyChecklistService safetyChecklistService;
    private final SafetyChecklistAttachmentService safetyChecklistAttachmentService;

    @Value("${file.upload-dir:./uploads}")
    private String uploadDir;

    // ── 模板 ───────────────────────────────────────────────────────────────────

    @PreAuthorize("@ss.hasPermi('safety:query')")
    @GetMapping("/templates")
    public Result<Page<SafetyChecklistTemplate>> listTemplates(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(safetyChecklistService.listTemplates(keyword, pageNum, pageSize));
    }

    @PreAuthorize("@ss.hasPermi('safety:query')")
    @GetMapping("/templates/{id}")
    public Result<SafetyChecklistTemplate> getTemplate(@PathVariable Long id) {
        return Result.success(safetyChecklistService.getTemplateById(id));
    }

    @PreAuthorize("@ss.hasPermi('safety:create')")
    @PostMapping("/templates")
    public Result<SafetyChecklistTemplate> createTemplate(@Valid @RequestBody SafetyChecklistTemplate template) {
        return Result.success(safetyChecklistService.createTemplate(template));
    }

    @PreAuthorize("@ss.hasPermi('safety:edit')")
    @PutMapping("/templates/{id}")
    public Result<SafetyChecklistTemplate> updateTemplate(@PathVariable Long id,
                                                          @Valid @RequestBody SafetyChecklistTemplate template) {
        return Result.success(safetyChecklistService.updateTemplate(id, template));
    }

    @PreAuthorize("@ss.hasPermi('safety:remove')")
    @DeleteMapping("/templates/{id}")
    public Result<Void> deleteTemplate(@PathVariable Long id) {
        safetyChecklistService.deleteTemplate(id);
        return Result.success();
    }

    // ── 检查项 ─────────────────────────────────────────────────────────────────

    @GetMapping("/templates/{templateId}/items")
    public Result<List<SafetyChecklistItem>> getItems(@PathVariable Long templateId) {
        return Result.success(safetyChecklistService.getItemsByTemplateId(templateId));
    }

    @PreAuthorize("@ss.hasPermi('safety:edit')")
    @PostMapping("/templates/{templateId}/items")
    public Result<SafetyChecklistItem> createItem(@PathVariable Long templateId,
                                                  @Valid @RequestBody SafetyChecklistItem item) {
        item.setTemplateId(templateId);
        return Result.success(safetyChecklistService.createItem(item));
    }

    @PreAuthorize("@ss.hasPermi('safety:edit')")
    @PutMapping("/items/{id}")
    public Result<SafetyChecklistItem> updateItem(@PathVariable Long id,
                                                  @Valid @RequestBody SafetyChecklistItem item) {
        return Result.success(safetyChecklistService.updateItem(id, item));
    }

    @PreAuthorize("@ss.hasPermi('safety:remove')")
    @DeleteMapping("/items/{id}")
    public Result<Void> deleteItem(@PathVariable Long id) {
        safetyChecklistService.deleteItem(id);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('safety:edit')")
    @PostMapping("/templates/{templateId}/items/batch")
    public Result<Void> batchSaveItems(@PathVariable Long templateId,
                                       @RequestBody List<SafetyChecklistItem> items) {
        safetyChecklistService.batchSaveItems(templateId, items);
        return Result.success();
    }

    // ── 执行 ───────────────────────────────────────────────────────────────────

    @PreAuthorize("@ss.hasPermi('safety:execute')")
    @PostMapping("/executions/start")
    public Result<SafetyChecklistExecution> startExecution(@RequestBody Map<String, Object> params) {
        Long templateId = Long.valueOf(params.get("templateId").toString());
        Long assetId = Long.valueOf(params.get("assetId").toString());
        Long executorId = Long.valueOf(params.get("executorId").toString());
        return Result.success(safetyChecklistService.startExecution(templateId, assetId, executorId));
    }

    @PreAuthorize("@ss.hasPermi('safety:execute')")
    @PostMapping("/executions/batch-start")
    public Result<SafetyChecklistBatchResult> batchStartExecutions(@RequestBody Map<String, Object> params) {
        Long templateId = Long.valueOf(params.get("templateId").toString());
        Long executorId = Long.valueOf(params.get("executorId").toString());
        @SuppressWarnings("unchecked")
        List<Long> assetIds = (List<Long>) params.get("assetIds");
        return Result.success(safetyChecklistService.batchStartExecutions(templateId, assetIds, executorId));
    }

    @GetMapping("/executions/{id}")
    public Result<SafetyChecklistExecution> getExecution(@PathVariable Long id) {
        return Result.success(safetyChecklistService.getExecutionById(id));
    }

    @PreAuthorize("@ss.hasPermi('safety:history')")
    @GetMapping("/executions")
    public Result<Page<SafetyChecklistExecution>> listExecutions(
            @RequestParam(required = false) Long templateId,
            @RequestParam(required = false) Long assetId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(safetyChecklistService.listExecutions(templateId, assetId, status, pageNum, pageSize));
    }

    @PreAuthorize("@ss.hasPermi('safety:execute')")
    @PostMapping("/executions/{id}/submit")
    public Result<Void> submitResults(@PathVariable Long id, @RequestBody List<SafetyChecklistResult> results) {
        safetyChecklistService.submitResults(id, results);
        return Result.success();
    }

    @PreAuthorize("@ss.hasPermi('safety:execute')")
    @PostMapping("/executions/{id}/complete")
    public Result<SafetyChecklistExecution> completeExecution(@PathVariable Long id) {
        return Result.success(safetyChecklistService.completeExecution(id));
    }

    // ── 执行结果 ───────────────────────────────────────────────────────────────

    @GetMapping("/executions/{executionId}/results")
    public Result<List<SafetyChecklistResult>> getResults(@PathVariable Long executionId) {
        return Result.success(safetyChecklistService.getResultsByExecutionId(executionId));
    }

    // ── 照片上传 ───────────────────────────────────────────────────────────────
    //
    // 分离式设计说明：
    // 安全检查表采用 Template-Item-Execution-Result 四层架构
    // - Template：检查表模板，定义检查项和周期
    // - Item：检查项，定义具体的检查内容（通过/不通过、读数、拍照、文本）
    // - Execution：执行记录，记录一次完整的检查执行（包含执行人、执行时间、状态）
    // - Result：检查结果，记录每个检查项的结果（通过/不通过、读数、照片URL、备注）
    //
    // 照片上传关联逻辑：
    // 照片关联到 Result 层（检查项结果），通过 resultId 精确定位照片属于哪个检查项。
    // 同一执行记录包含多个检查项，每个检查项可能需要上传不同的照片。
    //
    // 文件上传限制：
    // - 文件类型：仅允许 jpg、png、jpeg 格式的图片
    // - 文件大小：最大 5MB
    // - 权限控制：上传和删除需要 safety:execute 权限，查询需要 safety:query 权限

    /**
     * 上传照片到指定执行记录的指定检查项结果
     *
     * @param executionId 执行记录 ID（路径参数）
     * @param resultId 检查项结果 ID（路径参数，用于关联照片到具体检查项）
     * @param file 上传的文件
     * @param uploadBy 上传人 ID（请求参数，从当前用户获取）
     * @return 新增的附件记录
     */
    @PreAuthorize("@ss.hasPermi('safety:execute')")
    @PostMapping("/executions/{executionId}/results/{resultId}/photos")
    public Result<SysAttachment> uploadPhoto(
            @PathVariable Long executionId,
            @PathVariable Long resultId,
            @RequestParam("file") MultipartFile file,
            @RequestParam("uploadBy") Long uploadBy) {
        try {
            // 验证文件是否为空
            if (file == null || file.isEmpty()) {
                return Result.error("请选择要上传的文件");
            }

            // 验证文件类型（白名单）
            String contentType = file.getContentType();
            if (contentType == null || (!contentType.startsWith("image/jpeg") &&
                    !contentType.startsWith("image/png") &&
                    !contentType.startsWith("image/jpg"))) {
                return Result.error("不支持的文件类型，仅允许 jpg、png、jpeg 格式的图片");
            }

            // 验证文件大小（5MB）
            if (file.getSize() > 5 * 1024 * 1024) {
                return Result.error("文件大小不能超过 5MB");
            }

            String originalFilename = sanitizeFileName(file.getOriginalFilename());
            String fileName = "safety-checklist-" + executionId + "-" + UUID.randomUUID()
                    + resolveImageExtension(originalFilename, contentType);

            Path uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
            Path targetPath = uploadRoot.resolve(fileName).normalize();
            if (!targetPath.startsWith(uploadRoot)) {
                return Result.error("文件名不合法");
            }
            Files.createDirectories(uploadRoot);
            file.transferTo(targetPath.toFile());

            String filePath = "/api/file/" + fileName;

            // 调用附件服务创建附件记录
            SysAttachment attachment = safetyChecklistAttachmentService.addAttachment(
                    resultId,
                    fileName,
                    filePath,
                    file.getSize(),
                    contentType,
                    uploadBy
            );

            return Result.success(attachment);
        } catch (IllegalArgumentException e) {
            return Result.error(e.getMessage());
        } catch (Exception e) {
            return Result.error("上传照片失败：" + e.getMessage());
        }
    }

    /**
     * 查询指定执行记录的所有照片
     *
     * @param executionId 执行记录 ID
     * @return 照片列表
     */
    @PreAuthorize("@ss.hasPermi('safety:query')")
    @GetMapping("/executions/{executionId}/photos")
    public Result<List<SysAttachment>> getPhotos(@PathVariable Long executionId) {
        try {
            // 查询该执行记录的所有结果 ID
            List<SafetyChecklistResult> results = safetyChecklistService.getResultsByExecutionId(executionId);

            // 查询所有结果的附件
            List<SysAttachment> allAttachments = new java.util.ArrayList<>();
            for (SafetyChecklistResult result : results) {
                List<SysAttachment> attachments = safetyChecklistAttachmentService.getAttachments(result.getId());
                allAttachments.addAll(attachments);
            }

            return Result.success(allAttachments);
        } catch (Exception e) {
            return Result.error("查询照片失败：" + e.getMessage());
        }
    }

    /**
     * 删除指定照片
     *
     * @param id 照片 ID（附件 ID）
     * @return 删除结果
     */
    @PreAuthorize("@ss.hasPermi('safety:execute')")
    @DeleteMapping("/photos/{id}")
    public Result<Void> deletePhoto(@PathVariable Long id) {
        try {
            safetyChecklistAttachmentService.deleteAttachment(id);
            return Result.success();
        } catch (IllegalArgumentException e) {
            return Result.error(e.getMessage());
        } catch (Exception e) {
            return Result.error("删除照片失败：" + e.getMessage());
        }
    }

    private static String sanitizeFileName(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            return "photo";
        }
        return Paths.get(originalFilename).getFileName().toString();
    }

    private static String resolveImageExtension(String originalFilename, String contentType) {
        if (originalFilename != null) {
            String lower = originalFilename.toLowerCase();
            if (lower.endsWith(".jpg")) return ".jpg";
            if (lower.endsWith(".jpeg")) return ".jpeg";
            if (lower.endsWith(".png")) return ".png";
        }
        return "image/png".equals(contentType) ? ".png" : ".jpg";
    }

    // ── PDF 报告 ───────────────────────────────────────────────────────────────

    /**
     * 生成安全检查报告（PDF）
     *
     * @param id 执行记录 ID
     * @return PDF 字节流
     */
    @PreAuthorize("@ss.hasPermi('safety:query')")
    @GetMapping("/executions/{id}/report")
    public ResponseEntity<byte[]> generateReport(@PathVariable Long id) {
        try {
            byte[] pdfBytes = safetyChecklistService.generateReport(id);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_PDF);
            headers.setContentDispositionFormData("attachment", "safety_checklist_report_" + id + ".pdf");

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(pdfBytes);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .headers(new HttpHeaders())
                    .body(e.getMessage().getBytes());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .headers(new HttpHeaders())
                    .body(("生成报告失败：" + e.getMessage()).getBytes());
        }
    }
}
