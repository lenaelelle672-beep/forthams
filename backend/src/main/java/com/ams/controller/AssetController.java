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
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import com.ams.entity.SysAttachment;
import com.ams.service.AssetAttachmentService;
import org.springframework.web.multipart.MultipartFile;
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
