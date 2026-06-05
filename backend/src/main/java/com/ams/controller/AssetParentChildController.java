package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.AddRelationDTO;
import com.ams.entity.AssetParentChild;
import com.ams.service.AssetParentChildService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 资产主附属关系（父子关系）Controller。
 * <p>提供父子关系的 CRUD、树形查询端点。</p>
 * <ul>
 *   <li>GET    /assets/{assetId}/relations       — 获取子资产列表</li>
 *   <li>POST   /assets/{assetId}/relations       — 添加关联</li>
 *   <li>PUT    /assets/{assetId}/relations/{id}  — 修改关联</li>
 *   <li>DELETE /assets/{assetId}/relations/{id}  — 删除关联</li>
 *   <li>GET    /assets/{assetId}/relations/tree  — 获取父子关系树</li>
 * </ul>
 */
@RestController
@RequestMapping("/assets/{assetId}/relations")
@RequiredArgsConstructor
public class AssetParentChildController {

    private final AssetParentChildService assetParentChildService;

    /**
     * 获取子资产列表（带资产名称、编号等信息）。
     */
    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping
    public Result<List<Map<String, Object>>> getChildren(@PathVariable Long assetId) {
        return Result.success(assetParentChildService.getChildrenWithAssetInfo(assetId));
    }

    /**
     * 添加父子关系。
     * <p>自动进行循环引用校验和租户隔离校验。</p>
     */
    @PreAuthorize("@ss.hasPermi('asset:ledger:edit')")
    @PostMapping
    public Result<AssetParentChild> addRelation(
            @PathVariable Long assetId,
            @Valid @RequestBody AddRelationDTO dto) {
        // 确保请求 body 的 parentAssetId 与路径上的 assetId 一致
        if (dto.getParentAssetId() == null) {
            dto.setParentAssetId(assetId);
        }
        if (!assetId.equals(dto.getParentAssetId())) {
            return Result.error(400, "路径上的资产ID与请求体中的父资产ID不一致");
        }
        return Result.success(assetParentChildService.addRelation(dto));
    }

    /**
     * 修改父子关系。
     * <p>仅支持更新关系类型、数量和备注，不支持修改父资产和子资产。</p>
     */
    @PreAuthorize("@ss.hasPermi('asset:ledger:edit')")
    @PutMapping("/{id}")
    public Result<AssetParentChild> updateRelation(
            @PathVariable Long assetId,
            @PathVariable Long id,
            @Valid @RequestBody AddRelationDTO dto) {
        return Result.success(assetParentChildService.updateRelation(id, assetId, dto));
    }

    /**
     * 删除父子关系。
     */
    @PreAuthorize("@ss.hasPermi('asset:ledger:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> removeRelation(
            @PathVariable Long assetId,
            @PathVariable Long id) {
        assetParentChildService.removeRelation(id);
        return Result.success();
    }

    /**
     * 获取父子关系树结构（以指定资产为根）。
     */
    @PreAuthorize("@ss.hasPermi('asset:ledger:query')")
    @GetMapping("/tree")
    public Result<List<Map<String, Object>>> getTree(@PathVariable Long assetId) {
        return Result.success(assetParentChildService.getTree(assetId));
    }
}
