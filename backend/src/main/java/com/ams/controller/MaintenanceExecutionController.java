package com.ams.controller;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.ExecutionMaterialCreateDTO;
import com.ams.dto.ExecutionStartDTO;
import com.ams.dto.ExecutionStepCreateDTO;
import com.ams.dto.ExecutionStepUpdateDTO;
import com.ams.entity.MaintenanceExecution;
import com.ams.entity.MaintenanceExecutionMaterial;
import com.ams.entity.MaintenanceExecutionStep;
import com.ams.entity.SysAttachment;
import com.ams.entity.User;
import com.ams.mapper.SysAttachmentMapper;
import com.ams.mapper.UserMapper;
import com.ams.service.MaintenanceExecutionMaterialService;
import com.ams.service.MaintenanceExecutionService;
import com.ams.service.MaintenanceExecutionStepService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

/**
 * 维保执行跟踪 REST API。
 *
 * <p>提供 15 个端点覆盖施工执行全生命周期管理：
 * 开始/暂停/恢复/完成/查询/步骤 CRUD/物料 CRUD/照片上传。
 *
 * <p>所有权限注解使用 @ss.hasPermi() 格式，与项目现有 Controller 风格一致。
 */
@Slf4j
@RestController
@RequestMapping("/maintenance/execution")
@RequiredArgsConstructor
public class MaintenanceExecutionController {

    private final MaintenanceExecutionService executionService;
    private final MaintenanceExecutionStepService stepService;
    private final MaintenanceExecutionMaterialService materialService;
    private final SysAttachmentMapper attachmentMapper;
    private final UserMapper userMapper;

    @Value("${file.upload-dir:./uploads}")
    private String uploadDir;

    // ─────────────────────────────────────────────────────────────────────────
    // 执行生命周期操作
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * 开始施工：创建执行记录并触发工单流转。
     */
    @PreAuthorize("@ss.hasPermi('asset:maintenance:execution:start')")
    @PostMapping
    public Result<MaintenanceExecution> startExecution(@Valid @RequestBody ExecutionStartDTO dto) {
        return Result.success(executionService.start(dto));
    }

    /**
     * 暂停施工。
     */
    @PreAuthorize("@ss.hasPermi('asset:maintenance:execution:pause')")
    @PostMapping("/{id}/pause")
    public Result<MaintenanceExecution> pauseExecution(@PathVariable Long id) {
        return Result.success(executionService.pause(id));
    }

    /**
     * 恢复施工。
     */
    @PreAuthorize("@ss.hasPermi('asset:maintenance:execution:resume')")
    @PostMapping("/{id}/resume")
    public Result<MaintenanceExecution> resumeExecution(@PathVariable Long id) {
        return Result.success(executionService.resume(id));
    }

    /**
     * 完成施工：汇总工时/费用并触发工单流转。
     */
    @PreAuthorize("@ss.hasPermi('asset:maintenance:execution:complete')")
    @PostMapping("/{id}/complete")
    public Result<MaintenanceExecution> completeExecution(@PathVariable Long id) {
        return Result.success(executionService.complete(id));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 执行记录查询
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * 查询执行详情。
     */
    @PreAuthorize("@ss.hasPermi('asset:maintenance:query')")
    @GetMapping("/{id}")
    public Result<MaintenanceExecution> getExecution(@PathVariable Long id) {
        return Result.success(executionService.getById(id));
    }

    /**
     * 按维保记录ID查询执行列表。
     */
    @PreAuthorize("@ss.hasPermi('asset:maintenance:query')")
    @GetMapping("/by-record/{recordId}")
    public Result<List<MaintenanceExecution>> getByRecord(@PathVariable Long recordId) {
        return Result.success(executionService.getByMaintenanceRecordId(recordId));
    }

    /**
     * 按工单ID查询执行列表。
     */
    @PreAuthorize("@ss.hasPermi('asset:maintenance:query')")
    @GetMapping("/by-work-order/{workOrderId}")
    public Result<List<MaintenanceExecution>> getByWorkOrder(@PathVariable Long workOrderId) {
        return Result.success(executionService.getByWorkOrderId(workOrderId));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 施工步骤管理
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * 获取施工步骤列表。
     */
    @PreAuthorize("@ss.hasPermi('asset:maintenance:query')")
    @GetMapping("/{id}/steps")
    public Result<List<MaintenanceExecutionStep>> getSteps(@PathVariable Long id) {
        return Result.success(stepService.getSteps(id));
    }

    /**
     * 创建施工步骤。
     */
    @PreAuthorize("@ss.hasPermi('asset:maintenance:execution:start')")
    @PostMapping("/{id}/steps")
    public Result<MaintenanceExecutionStep> createStep(@PathVariable Long id,
                                                       @Valid @RequestBody ExecutionStepCreateDTO dto) {
        dto.setExecutionId(id);
        return Result.success(stepService.createStep(dto));
    }

    /**
     * 更新施工步骤。
     */
    @PreAuthorize("@ss.hasPermi('asset:maintenance:execution:start')")
    @PutMapping("/{id}/steps/{stepId}")
    public Result<MaintenanceExecutionStep> updateStep(@PathVariable Long id,
                                                       @PathVariable Long stepId,
                                                       @Valid @RequestBody ExecutionStepUpdateDTO dto) {
        return Result.success(stepService.updateStep(stepId, dto));
    }

    /**
     * 删除施工步骤。
     */
    @PreAuthorize("@ss.hasPermi('asset:maintenance:execution:start')")
    @DeleteMapping("/{id}/steps/{stepId}")
    public Result<Void> deleteStep(@PathVariable Long id,
                                   @PathVariable Long stepId) {
        stepService.deleteStep(stepId);
        return Result.success();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 物料/备件管理
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * 获取物料列表。
     */
    @PreAuthorize("@ss.hasPermi('asset:maintenance:query')")
    @GetMapping("/{id}/materials")
    public Result<List<MaintenanceExecutionMaterial>> getMaterials(@PathVariable Long id) {
        return Result.success(materialService.getMaterials(id));
    }

    /**
     * 添加物料记录。
     */
    @PreAuthorize("@ss.hasPermi('asset:maintenance:execution:material')")
    @PostMapping("/{id}/materials")
    public Result<MaintenanceExecutionMaterial> addMaterial(@PathVariable Long id,
                                                            @Valid @RequestBody ExecutionMaterialCreateDTO dto) {
        dto.setExecutionId(id);
        return Result.success(materialService.addMaterial(dto));
    }

    /**
     * 删除物料记录。
     */
    @PreAuthorize("@ss.hasPermi('asset:maintenance:execution:material')")
    @DeleteMapping("/{id}/materials/{materialId}")
    public Result<Void> deleteMaterial(@PathVariable Long id,
                                       @PathVariable Long materialId) {
        materialService.deleteMaterial(materialId);
        return Result.success();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 照片上传
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * 上传现场照片并关联到执行记录。
     *
     * <p>后端一体化方案：接收 MultipartFile 上传，调用 FileController 的内部
     * Service 落盘文件，并维护 SysAttachment（business_type='MAINTENANCE_EXECUTION'）关联。
     */
    @PreAuthorize("@ss.hasPermi('asset:maintenance:execution:material')")
    @PostMapping("/{id}/upload-photo")
    public Result<String> uploadPhoto(@PathVariable Long id,
                                       @RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            // 空文件属客户端错误，返回 400 而非默认 500
            return Result.error(400, "上传文件不能为空");
        }

        try {
            // 1. 生成唯一文件名
            String originalFilename = file.getOriginalFilename();
            String ext = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                ext = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String newFilename = UUID.randomUUID().toString() + ext;

            // 2. 落盘文件（与 FileController.upload 采用相同存储策略）
            Path targetPath = Paths.get(uploadDir, newFilename);
            Files.createDirectories(targetPath.getParent());
            file.transferTo(targetPath.toFile());
            String fileUrl = "/api/file/" + newFilename;

            // 3. 创建 SysAttachment 关联记录
            SysAttachment attachment = new SysAttachment();
            attachment.setTenantId(TenantContext.requireTenantId());
            attachment.setBusinessType("MAINTENANCE_EXECUTION");
            attachment.setBusinessId(id);
            attachment.setFileName(originalFilename != null ? originalFilename : "unknown");
            attachment.setFilePath(fileUrl);
            attachment.setFileSize(file.getSize());
            attachment.setFileType(file.getContentType());
            attachment.setUploadBy(getCurrentUserId());
            attachmentMapper.insert(attachment);

            log.info("照片上传成功: executionId={}, file={}, url={}", id, newFilename, fileUrl);
            return Result.success(fileUrl);
        } catch (IOException e) {
            log.error("照片上传失败: executionId={}", id, e);
            return Result.error("文件上传失败: " + e.getMessage());
        }
    }

    /**
     * 从 Spring Security SecurityContext 中获取当前认证用户的数据库 ID。
     */
    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new BusinessException("未获取到当前用户");
        }
        String username = auth.getName();
        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>()
                        .eq(User::getUsername, username)
                        .eq(User::getStatus, 1)
                        .last("LIMIT 1")
        );
        if (user == null) {
            throw new BusinessException("未获取到当前用户");
        }
        return user.getId();
    }
}
