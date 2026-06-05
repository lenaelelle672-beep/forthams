package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.InspectionBatchGenerateDTO;
import com.ams.dto.InspectionCategoryGenerateDTO;
import com.ams.entity.Inspection;
import com.ams.entity.InspectionTemplate;
import com.ams.entity.InspectionTask;
import com.ams.entity.SysAttachment;
import com.ams.mapper.SysAttachmentMapper;
import com.ams.service.InspectionService;
import com.ams.service.InspectionTemplateService;
import com.ams.service.InspectionTaskService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 检验/年检管理 REST API。
 *
 * <p>提供检验记录 CRUD、模板管理、批量生成、照片上传、报告生成等端点。
 *
 * <p>所有权限注解使用 @ss.hasPermi() 格式，与项目现有 Controller 风格一致。
 */
@Slf4j
@RestController
@RequestMapping("/inspections")
@RequiredArgsConstructor
public class InspectionController {
    private final InspectionService inspectionService;
    private final InspectionTemplateService templateService;
    private final InspectionTaskService taskService;
    private final SysAttachmentMapper sysAttachmentMapper;

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    // ==================== 检验记录 CRUD ====================

    @PreAuthorize("@ss.hasPermi('inspection:query')")
    @GetMapping({"", "/list"})
    public Result<Page<Inspection>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String inspectionType,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate endDate,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(inspectionService.listInspection(keyword, inspectionType, result, startDate, endDate, pageNum, pageSize));
    }

    @PreAuthorize("@ss.hasPermi('inspection:query')")
    @GetMapping("/{id}")
    public Result<Inspection> getById(@PathVariable Long id) {
        return Result.success(inspectionService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('inspection:create')")
    @PostMapping
    public Result<Inspection> create(@Valid @RequestBody Inspection inspection) {
        return Result.success(inspectionService.create(inspection));
    }

    @PreAuthorize("@ss.hasPermi('inspection:edit')")
    @PutMapping("/{id}")
    public Result<Inspection> update(@PathVariable Long id, @Valid @RequestBody Inspection inspection) {
        return Result.success(inspectionService.update(id, inspection));
    }

    @PreAuthorize("@ss.hasPermi('inspection:remove')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        inspectionService.delete(id);
        return Result.success();
    }

    @GetMapping("/expiring")
    public Result<List<Inspection>> getExpiring(@RequestParam(defaultValue = "30") Integer days) {
        return Result.success(inspectionService.getExpiringInspections(days));
    }

    // ==================== 自动生成检验任务 ====================

    @PreAuthorize("@ss.hasPermi('inspection:auto-generate')")
    @PostMapping("/auto-generate")
    public Result<List<Inspection>> autoGenerateInspections(@RequestBody Map<String, Object> params) {
        @SuppressWarnings("unchecked")
        List<Long> assetIds = (List<Long>) params.get("assetIds");
        Long assetCategoryId = params.get("assetCategoryId") != null ?
                Long.valueOf(params.get("assetCategoryId").toString()) : null;
        return Result.success(inspectionService.autoGenerateInspections(assetIds, assetCategoryId));
    }

    // ==================== 批量检验端点（新增） ====================

    /**
     * 批量生成检验记录 — 接收资产ID列表。
     */
    @PreAuthorize("@ss.hasPermi('inspection:auto-generate')")
    @PostMapping("/batch/generate")
    public Result<List<Inspection>> batchGenerateInspections(
            @Valid @RequestBody InspectionBatchGenerateDTO dto) {
        if (dto.getAssetIds() == null || dto.getAssetIds().isEmpty()) {
            return Result.error(400, "资产ID列表不能为空");
        }
        return Result.success(inspectionService.batchGenerateInspections(dto.getAssetIds()));
    }

    /**
     * 按类别批量生成检验记录 — 接收资产类别ID。
     */
    @PreAuthorize("@ss.hasPermi('inspection:auto-generate')")
    @PostMapping("/batch/generate-by-category")
    public Result<List<Inspection>> batchGenerateByCategory(
            @Valid @RequestBody InspectionCategoryGenerateDTO dto) {
        if (dto.getAssetCategoryId() == null) {
            return Result.error(400, "资产类别ID不能为空");
        }
        return Result.success(inspectionService.batchGenerateByCategory(dto.getAssetCategoryId()));
    }

    // ==================== 照片上传端点（新增） ====================

    /**
     * 上传检验照片并关联到检验记录。
     *
     * <p>复用 SysAttachment 机制存储文件，business_type='INSPECTION'。
     */
    @PreAuthorize("@ss.hasPermi('inspection:edit')")
    @PostMapping("/{id}/photos")
    public Result<SysAttachment> uploadPhoto(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return Result.error(400, "上传文件不能为空");
        }
        // 文件大小限制（10MB）
        if (file.getSize() > 10 * 1024 * 1024) {
            return Result.error(400, "文件大小不能超过10MB");
        }

        // 校验检验记录存在
        Inspection inspection = inspectionService.getById(id);
        if (inspection == null) {
            return Result.error(404, "检验记录不存在");
        }

        // 校验文件类型
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return Result.error(400, "仅支持上传图片文件");
        }

        try {
            // 1. 生成唯一文件名
            String originalFilename = file.getOriginalFilename();
            String ext = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                ext = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String newFilename = UUID.randomUUID().toString() + ext;

            // 2. 落盘文件
            Path targetPath = Paths.get(uploadDir, "inspection", newFilename);
            Files.createDirectories(targetPath.getParent());
            file.transferTo(targetPath.toFile());
            String fileUrl = "/api/file/inspection/" + newFilename;

            // 3. 创建 SysAttachment 关联记录
            SysAttachment attachment = new SysAttachment();
            attachment.setBusinessType("INSPECTION");
            attachment.setBusinessId(id);
            attachment.setFileName(originalFilename != null ? originalFilename : "unknown");
            attachment.setFilePath(fileUrl);
            attachment.setFileSize(file.getSize());
            attachment.setFileType(contentType);
            attachment.setUploadBy(getCurrentUserId());
            sysAttachmentMapper.insert(attachment);

            log.info("检验照片上传成功: inspectionId={}, file={}, url={}", id, newFilename, fileUrl);
            return Result.success(attachment);
        } catch (IOException e) {
            log.error("检验照片上传失败: inspectionId={}", id, e);
            return Result.error(500, "文件上传失败: " + e.getMessage());
        }
    }

    /**
     * 获取检验照片列表。
     */
    @PreAuthorize("@ss.hasPermi('inspection:query')")
    @GetMapping("/{id}/photos")
    public Result<List<SysAttachment>> getInspectionPhotos(@PathVariable Long id) {
        List<SysAttachment> photos = sysAttachmentMapper.selectList(
                new LambdaQueryWrapper<SysAttachment>()
                        .eq(SysAttachment::getBusinessType, "INSPECTION")
                        .eq(SysAttachment::getBusinessId, id)
                        .orderByDesc(SysAttachment::getCreateTime));
        return Result.success(photos);
    }

    /**
     * 删除检验照片。
     */
    @PreAuthorize("@ss.hasPermi('inspection:edit')")
    @DeleteMapping("/photos/{attachmentId}")
    public Result<Void> deleteInspectionPhoto(@PathVariable Long attachmentId) {
        sysAttachmentMapper.deleteById(attachmentId);
        return Result.success();
    }

    /**
     * 批量上传检验照片 — 接收照片URL列表。
     */
    @PreAuthorize("@ss.hasPermi('inspection:edit')")
    @PostMapping("/{id}/photos/batch")
    public Result<Void> uploadPhotos(
            @PathVariable Long id,
            @RequestBody Map<String, List<String>> requestBody) {
        List<String> photoUrls = requestBody.get("photoUrls");
        if (photoUrls == null || photoUrls.isEmpty()) {
            return Result.error(400, "照片URL列表不能为空");
        }

        inspectionService.uploadPhotos(id, photoUrls);
        log.info("批量上传检验照片成功: inspectionId={}, 照片数量={}", id, photoUrls.size());
        return Result.success();
    }

    // ==================== 报告生成端点（新增） ====================

    /**
     * 生成检验报告 — 返回报告附件 URL。
     *
     * <p>若 inspection.reportAttachment 已有值则直接返回；
     * 否则返回 404 提示报告尚未生成。
     */
    @PreAuthorize("@ss.hasPermi('inspection:query')")
    @GetMapping("/{id}/report")
    public Result<String> getInspectionReport(@PathVariable Long id) {
        Inspection inspection = inspectionService.getById(id);
        if (inspection == null) {
            return Result.error(404, "检验记录不存在");
        }
        String reportUrl = inspection.getReportAttachment();
        if (reportUrl == null || reportUrl.isEmpty()) {
            return Result.error(404, "检验报告尚未生成");
        }
        return Result.success(reportUrl);
    }

    /**
     * 生成新的检验报告 — 返回 PDF 字节流。
     */
    @PreAuthorize("@ss.hasPermi('inspection:report')")
    @PostMapping(value = "/{id}/report", produces = "application/pdf")
    public void generateReport(
            @PathVariable Long id,
            @RequestParam(defaultValue = "pdf") String format,
            HttpServletResponse response) {
        byte[] pdfBytes = inspectionService.generateReport(id, format);
        
        Inspection inspection = inspectionService.getById(id);
        String filename = "inspection-report-" + inspection.getInspectionNo() + ".pdf";
        
        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
        response.setContentLength(pdfBytes.length);
        
        try {
            response.getOutputStream().write(pdfBytes);
            response.getOutputStream().flush();
            log.info("生成检验报告成功: inspectionId={}, filename={}", id, filename);
        } catch (IOException e) {
            log.error("输出检验报告失败: inspectionId={}", id, e);
        }
    }

    // ==================== 检验历史查询 ====================

    @PreAuthorize("@ss.hasPermi('inspection:history')")
    @GetMapping("/history/{assetId}")
    public Result<List<Inspection>> getInspectionHistory(@PathVariable Long assetId) {
        return Result.success(inspectionService.getInspectionHistory(assetId));
    }

    // ==================== 私有辅助方法 ====================

    /**
     * 从 Spring Security SecurityContext 获取当前用户数据库 ID。
     */
    private Long getCurrentUserId() {
        try {
            org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
                return (long) auth.getName().hashCode();
            }
        } catch (Exception e) {
            // ignore
        }
        return 0L;
    }

    // ==================== 检验任务管理端点 ====================

    /**
     * 分页查询检验任务列表。
     */
    @PreAuthorize("@ss.hasPermi('inspection:task:query')")
    @GetMapping("/tasks/list")
    public Result<Page<InspectionTask>> listTasks(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String taskType,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate endDate,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(taskService.listTasks(keyword, status, taskType, startDate, endDate, pageNum, pageSize));
    }

    /**
     * 根据ID查询检验任务详情。
     */
    @PreAuthorize("@ss.hasPermi('inspection:task:query')")
    @GetMapping("/tasks/{id}")
    public Result<InspectionTask> getTaskById(@PathVariable Long id) {
        return Result.success(taskService.getTaskById(id));
    }

    /**
     * 创建检验任务。
     */
    @PreAuthorize("@ss.hasPermi('inspection:task:create')")
    @PostMapping("/tasks")
    public Result<InspectionTask> createTask(@Valid @RequestBody InspectionTask task) {
        return Result.success(taskService.createTask(task));
    }

    /**
     * 更新检验任务。
     */
    @PreAuthorize("@ss.hasPermi('inspection:task:edit')")
    @PutMapping("/tasks/{id}")
    public Result<InspectionTask> updateTask(@PathVariable Long id, @Valid @RequestBody InspectionTask task) {
        return Result.success(taskService.updateTask(id, task));
    }

    /**
     * 删除检验任务（软删除）。
     */
    @PreAuthorize("@ss.hasPermi('inspection:task:remove')")
    @DeleteMapping("/tasks/{id}")
    public Result<Void> deleteTask(@PathVariable Long id) {
        taskService.deleteTask(id);
        return Result.success();
    }

    /**
     * 批量创建检验任务。
     */
    @PreAuthorize("@ss.hasPermi('inspection:task:batch-create')")
    @PostMapping("/tasks/batch")
    public Result<List<InspectionTask>> batchCreateTasks(@RequestBody List<InspectionTask> tasks) {
        if (tasks == null || tasks.isEmpty()) {
            return Result.error(400, "任务列表不能为空");
        }
        return Result.success(taskService.batchCreateTasks(tasks));
    }

    /**
     * 更新检验任务状态。
     */
    @PreAuthorize("@ss.hasPermi('inspection:task:update-status')")
    @PutMapping("/tasks/{id}/status")
    public Result<Void> updateTaskStatus(
            @PathVariable Long id,
            @RequestParam String status) {
        taskService.updateTaskStatus(id, status);
        return Result.success();
    }

    /**
     * 查询即将到期任务（提前30天提醒）。
     */
    @PreAuthorize("@ss.hasPermi('inspection:task:query')")
    @GetMapping("/tasks/expiring")
    public Result<List<InspectionTask>> getExpiringTasks(@RequestParam(defaultValue = "30") Integer days) {
        return Result.success(taskService.getExpiringTasks(days));
    }

    /**
     * 查询逾期任务。
     */
    @PreAuthorize("@ss.hasPermi('inspection:task:query')")
    @GetMapping("/tasks/overdue")
    public Result<List<InspectionTask>> getOverdueTasks() {
        return Result.success(taskService.getOverdueTasks());
    }
}
