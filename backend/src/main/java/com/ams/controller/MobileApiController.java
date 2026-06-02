package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.Asset;
import com.ams.entity.NotificationRecord;
import com.ams.entity.User;
import com.ams.entity.WorkOrder;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.NotificationMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.WorkOrderMapper;
import com.ams.service.AssetService;
import com.ams.service.NotificationService;
import com.ams.service.WorkOrderService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 移动端简化 API
 *
 * <p>返回轻量数据结构，适配 H5/PWA 移动端使用。
 * 复用现有业务 Service，不做数据层变更。</p>
 */
@Slf4j
@RestController
@RequestMapping("/mobile")
@RequiredArgsConstructor
public class MobileApiController {

    private final AssetService assetService;
    private final AssetMapper assetMapper;
    private final WorkOrderService workOrderService;
    private final WorkOrderMapper workOrderMapper;
    private final NotificationService notificationService;
    private final NotificationMapper notificationMapper;
    private final UserMapper userMapper;

    // ── 仪表盘摘要 ─────────────────────────────────────────────────────────

    /**
     * 移动端仪表盘摘要：资产数、待办数、告警数。
     */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/dashboard")
    public Result<Map<String, Object>> dashboard() {
        Long userId = getCurrentUserId();
        String tenantId = getCurrentTenantId();

        Map<String, Object> result = new LinkedHashMap<>();

        // 资产统计
        long totalAssets = assetMapper.selectCount(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId));
        long inUseAssets = assetMapper.selectCount(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId)
                .eq(Asset::getStatus, "IN_USE"));
        long idleAssets = assetMapper.selectCount(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId)
                .eq(Asset::getStatus, "IDLE"));
        long scrapAssets = assetMapper.selectCount(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId)
                .eq(Asset::getStatus, "SCRAPPED"));

        result.put("totalAssets", totalAssets);
        result.put("inUseAssets", inUseAssets);
        result.put("idleAssets", idleAssets);
        result.put("scrapAssets", scrapAssets);

        // 待办工单数
        long pendingWorkOrders = workOrderMapper.selectCount(new LambdaQueryWrapper<WorkOrder>()
                .eq(WorkOrder::getTenantId, tenantId)
                .in(WorkOrder::getStatus, "PENDING", "IN_PROGRESS"));
        result.put("pendingWorkOrders", pendingWorkOrders);

        // 未读通知数
        long unreadNotifications = notificationMapper.selectCount(new LambdaQueryWrapper<NotificationRecord>()
                .eq(NotificationRecord::getUserId, userId)
                .eq(NotificationRecord::getIsRead, 0));
        result.put("unreadNotifications", unreadNotifications);

        return Result.success(result);
    }

    // ── 资产列表（简化字段） ───────────────────────────────────────────────

    /**
     * 移动端资产列表：分页返回简化字段。
     */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/assets")
    public Result<Map<String, Object>> assetList(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {
        String tenantId = getCurrentTenantId();

        Page<Asset> pageObj = new Page<>(page, pageSize);
        LambdaQueryWrapper<Asset> wrapper = new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId);

        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like(Asset::getAssetNo, keyword)
                    .or().like(Asset::getAssetName, keyword));
        }
        if (status != null && !status.isBlank()) {
            wrapper.eq(Asset::getStatus, status);
        }
        wrapper.orderByDesc(Asset::getCreateTime);

        Page<Asset> pageResult = assetMapper.selectPage(pageObj, wrapper);

        // 构建简化响应
        List<Map<String, Object>> records = pageResult.getRecords().stream()
                .map(this::toSimpleAssetItem)
                .collect(Collectors.toList());

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("records", records);
        data.put("total", pageResult.getTotal());
        data.put("page", page);
        data.put("pageSize", pageSize);

        return Result.success(data);
    }

    /**
     * 移动端资产详情。
     */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/assets/{id}")
    public Result<Map<String, Object>> assetDetail(@PathVariable Long id) {
        Asset asset = assetService.getAssetById(id);
        if (asset == null) {
            return Result.error("资产不存在");
        }

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("id", asset.getId());
        detail.put("assetNo", asset.getAssetNo());
        detail.put("assetName", asset.getAssetName());
        detail.put("status", asset.getStatus());
        detail.put("categoryId", asset.getCategoryId());
        detail.put("model", asset.getModel());
        detail.put("brand", asset.getBrand());
        detail.put("serialNo", asset.getSerialNo());
        detail.put("supplier", asset.getSupplier());
        detail.put("originalValue", asset.getOriginalValue());
        detail.put("currentValue", asset.getCurrentValue());
        detail.put("purchaseDate", asset.getPurchaseDate());
        detail.put("warrantyPeriod", asset.getWarrantyPeriod());
        detail.put("locationName", asset.getLocationName());
        detail.put("locationId", asset.getLocationId());
        detail.put("rfidTag", asset.getRfidTag());
        detail.put("description", asset.getDescription());
        detail.put("remark", asset.getRemark());
        detail.put("createTime", asset.getCreateTime());

        return Result.success(detail);
    }

    // ── 待办工单 ───────────────────────────────────────────────────────────

    /**
     * 移动端待办工单列表。
     */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/work-orders")
    public Result<Map<String, Object>> workOrders(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer pageSize) {
        String tenantId = getCurrentTenantId();

        Page<WorkOrder> pageObj = new Page<>(page, pageSize);
        LambdaQueryWrapper<WorkOrder> wrapper = new LambdaQueryWrapper<WorkOrder>()
                .eq(WorkOrder::getTenantId, tenantId)
                .in(WorkOrder::getStatus, "PENDING", "IN_PROGRESS", "APPROVING_LEVEL_1")
                .orderByDesc(WorkOrder::getCreateTime);

        Page<WorkOrder> pageResult = workOrderMapper.selectPage(pageObj, wrapper);

        List<Map<String, Object>> records = pageResult.getRecords().stream()
                .map(this::toSimpleWorkOrderItem)
                .collect(Collectors.toList());

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("records", records);
        data.put("total", pageResult.getTotal());
        data.put("page", page);
        data.put("pageSize", pageSize);

        return Result.success(data);
    }

    // ── 未读通知 ───────────────────────────────────────────────────────────

    /**
     * 移动端未读通知列表。
     */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/notifications")
    public Result<List<Map<String, Object>>> notifications() {
        Long userId = getCurrentUserId();
        List<NotificationRecord> list = notificationService.getUnreadList(userId);

        List<Map<String, Object>> items = list.stream()
                .map(this::toSimpleNotificationItem)
                .collect(Collectors.toList());

        return Result.success(items);
    }

    // ── 扫码查询 ───────────────────────────────────────────────────────────

    /**
     * 扫码查询：通过条码或 RFID 查询资产。
     */
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/scan")
    public Result<Map<String, Object>> scan(@RequestBody Map<String, String> body) {
        String code = body.get("code");
        if (code == null || code.isBlank()) {
            return Result.error("请提供扫码内容");
        }

        String tenantId = getCurrentTenantId();

        // 先按 assetNo 匹配，再按 rfidTag 匹配
        Asset asset = assetMapper.selectOne(new LambdaQueryWrapper<Asset>()
                .eq(Asset::getTenantId, tenantId)
                .eq(Asset::getAssetNo, code)
                .last("LIMIT 1"));

        if (asset == null) {
            asset = assetMapper.selectOne(new LambdaQueryWrapper<Asset>()
                    .eq(Asset::getTenantId, tenantId)
                    .eq(Asset::getRfidTag, code)
                    .last("LIMIT 1"));
        }

        if (asset == null) {
            return Result.error("未找到匹配的资产");
        }

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("id", asset.getId());
        detail.put("assetNo", asset.getAssetNo());
        detail.put("assetName", asset.getAssetName());
        detail.put("status", asset.getStatus());
        detail.put("model", asset.getModel());
        detail.put("brand", asset.getBrand());
        detail.put("locationName", asset.getLocationName());
        detail.put("rfidTag", asset.getRfidTag());
        detail.put("originalValue", asset.getOriginalValue());

        return Result.success(detail);
    }

    // ── 辅助方法 ──────────────────────────────────────────────────────────────

    private Map<String, Object> toSimpleAssetItem(Asset asset) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", asset.getId());
        item.put("assetNo", asset.getAssetNo());
        item.put("assetName", asset.getAssetName());
        item.put("status", asset.getStatus());
        item.put("locationName", asset.getLocationName());
        item.put("model", asset.getModel());
        item.put("brand", asset.getBrand());
        item.put("createTime", asset.getCreateTime());
        return item;
    }

    private Map<String, Object> toSimpleWorkOrderItem(WorkOrder wo) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", wo.getId());
        item.put("workOrderNo", wo.getWorkOrderNo());
        item.put("title", wo.getTitle());
        item.put("status", wo.getStatus());
        item.put("priority", wo.getPriority());
        item.put("assetName", wo.getAssetName());
        item.put("reporterName", wo.getReporterName());
        item.put("assigneeName", wo.getAssigneeName());
        item.put("createTime", wo.getCreateTime());
        return item;
    }

    private Map<String, Object> toSimpleNotificationItem(NotificationRecord record) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", record.getId());
        item.put("title", record.getTitle());
        item.put("content", record.getContent());
        item.put("type", record.getType());
        item.put("category", record.getCategory());
        item.put("createTime", record.getCreatedAt());
        item.put("isRead", record.getIsRead());
        return item;
    }

    private Long getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new com.ams.common.exception.BusinessException("未获取到当前用户");
        }
        String username = auth.getName();
        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>()
                        .eq(User::getUsername, username)
                        .eq(User::getStatus, 1)
                        .last("LIMIT 1")
        );
        if (user == null) {
            throw new com.ams.common.exception.BusinessException("未获取到当前用户");
        }
        return user.getId();
    }

    private String getCurrentTenantId() {
        return com.ams.context.TenantContext.requireTenantId();
    }
}
