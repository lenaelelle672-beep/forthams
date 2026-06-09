package com.ams.controller;

import com.ams.common.Result;
import com.ams.context.TenantContext;
import com.ams.dto.BatchResult;
import com.ams.service.ABCClassificationService;
import com.ams.service.ABCClassificationService.ClassificationStatistics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * ABC 分类管理控制器
 */
@Slf4j
@RestController
@RequestMapping("/abc")
@RequiredArgsConstructor
public class ABCClassificationController {

    private final ABCClassificationService abcClassificationService;

    /**
     * 批量重新分类所有资产
     */
    @PostMapping("/reclassify")
    @PreAuthorize("@ss.hasPermi('abc:reclassify')")
    public Result<BatchResult> reclassifyAll() {
        String tenantId = TenantContext.requireTenantId();
        log.info("[ABC分类] 批量重新分类请求 [tenantId={}]", tenantId);

        BatchResult result = abcClassificationService.reclassifyAll();
        return Result.success(result.getMessage(), result);
    }

    /**
     * 单个资产重新分类
     */
    @PostMapping("/reclassify/{assetId}")
    @PreAuthorize("@ss.hasPermi('abc:reclassify')")
    public Result<String> reclassifyAsset(@PathVariable Long assetId) {
        String tenantId = TenantContext.requireTenantId();
        log.info("[ABC分类] 单个资产重新分类请求 [tenantId={}, assetId={}]", tenantId, assetId);

        String classification = abcClassificationService.classifyAsset(assetId);
        return Result.success(classification);
    }

    /**
     * 按分类 ID 批量重新分类
     */
    @PostMapping("/reclassify/by-category")
    @PreAuthorize("@ss.hasPermi('abc:reclassify')")
    public Result<BatchResult> reclassifyByCategoryIds(@RequestBody List<Long> categoryIds) {
        String tenantId = TenantContext.requireTenantId();
        log.info("[ABC分类] 按分类 ID 批量重新分类请求 [tenantId={}, categoryIds={}]", tenantId, categoryIds);

        BatchResult result = abcClassificationService.reclassifyByCategoryIds(categoryIds);
        return Result.success(result.getMessage(), result);
    }

    /**
     * 获取分类统计
     */
    @GetMapping("/statistics")
    @PreAuthorize("@ss.hasPermi('abc:query')")
    public Result<ClassificationStatistics> getStatistics() {
        String tenantId = TenantContext.requireTenantId();
        log.info("[ABC分类] 获取分类统计请求 [tenantId={}]", tenantId);

        ClassificationStatistics stats = abcClassificationService.getStatistics();
        return Result.success(stats);
    }

    /**
     * 查询资产当前分类
     */
    @GetMapping("/{assetId}")
    @PreAuthorize("@ss.hasPermi('abc:query')")
    public Result<String> getByAssetId(@PathVariable Long assetId) {
        String tenantId = TenantContext.requireTenantId();
        log.info("[ABC分类] 查询资产分类请求 [tenantId={}, assetId={}]", tenantId, assetId);

        String classification = abcClassificationService.getByAssetId(assetId);
        return Result.success(classification);
    }
}
