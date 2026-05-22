package com.ams.controller;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.NotificationRecord;
import com.ams.service.ApprovalService;
import com.ams.service.NotificationService;
import com.ams.utils.JwtUtil;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 通知中心控制器
 *
 * <p>提供通知的 CRUD 端点，基于独立的 notification 表持久化。
 * 保留 /pending 兼容端点，从 ApprovalService 派生。</p>
 */
@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final ApprovalService approvalService;
    private final JwtUtil jwtUtil;

    /**
     * 分页查询通知列表。
     * 从独立 notification 表查询，支持按 type/category 过滤。
     */
    @GetMapping
    public Result<Map<String, Object>> list(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            HttpServletRequest request) {
        Long userId = getCurrentUserId(request);
        Page<NotificationRecord> pageResult = notificationService.getPage(userId, page, pageSize, category, type);

        List<Map<String, Object>> records = pageResult.getRecords().stream()
                .map(this::toNotificationItem)
                .toList();

        Map<String, Object> pageData = new LinkedHashMap<>();
        pageData.put("records", records);
        pageData.put("total", pageResult.getTotal());
        pageData.put("size", pageSize);
        pageData.put("current", page);
        pageData.put("pages", pageResult.getPages());
        return Result.success(pageData);
    }

    /**
     * 获取未读通知数量（新端点）。
     */
    @GetMapping("/unread-count")
    public Result<Long> unreadCount(HttpServletRequest request) {
        Long userId = getCurrentUserId(request);
        return Result.success(notificationService.getUnreadCount(userId));
    }

    /**
     * 兼容旧端点：获取待处理通知列表（从审批流程派生）。
     */
    @GetMapping("/pending")
    public Result<Map<String, Object>> pending(
            @RequestParam(required = false) String type,
            HttpServletRequest request) {
        Long userId = getCurrentUserId(request);
        List<Map<String, Object>> items = approvalService.getMyPendingApprovals(userId)
                .stream()
                .map(this::toApprovalNotificationItem)
                .filter(item -> type == null || type.isBlank() || type.equals(item.get("type")))
                .toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("unread_count", items.size());
        response.put("items", items);
        return Result.success(response);
    }

    /**
     * 兼容旧端点：获取待处理通知数量。
     */
    @GetMapping("/pending/count")
    public Result<Long> pendingCount(HttpServletRequest request) {
        Long userId = getCurrentUserId(request);
        // 优先返回真实未读数
        return Result.success(notificationService.getUnreadCount(userId));
    }

    /**
     * 标记单条通知为已读。
     */
    @PutMapping("/{id}/read")
    public Result<Void> markAsRead(@PathVariable Long id, HttpServletRequest request) {
        Long userId = getCurrentUserId(request);
        notificationService.markAsRead(id, userId);
        return Result.success();
    }

    /**
     * 全部标记为已读。
     */
    @PutMapping("/read-all")
    public Result<Void> markAllAsRead(HttpServletRequest request) {
        Long userId = getCurrentUserId(request);
        notificationService.markAllAsRead(userId);
        return Result.success();
    }

    /**
     * 删除通知。
     */
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id, HttpServletRequest request) {
        Long userId = getCurrentUserId(request);
        notificationService.delete(id, userId);
        return Result.success();
    }

    // ==================== 私有方法 ====================

    /**
     * 将 NotificationRecord 转为前端响应 Map。
     */
    private Map<String, Object> toNotificationItem(NotificationRecord record) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", record.getId());
        item.put("type", record.getType());
        item.put("category", record.getCategory());
        item.put("title", record.getTitle());
        item.put("content", record.getContent());
        item.put("isRead", record.getIsRead() != null && record.getIsRead() == 1);
        item.put("read", record.getIsRead() != null && record.getIsRead() == 1);
        item.put("refId", record.getRefId());
        item.put("refType", record.getRefType());
        item.put("created_at", record.getCreatedAt() == null ? "" : record.getCreatedAt().toString());
        item.put("createTime", record.getCreatedAt() == null ? "" : record.getCreatedAt().toString());
        return item;
    }

    /**
     * 将 ApprovalProcess 转为旧格式通知 Map（兼容 /pending 端点）。
     */
    private Map<String, Object> toApprovalNotificationItem(ApprovalProcess process) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", process.getId());
        item.put("type", toNotificationType(process.getProcessType()));
        item.put("category", toNotificationCategory(process.getProcessType()));
        item.put("title", buildTitle(process));
        item.put("content", buildContent(process));
        item.put("created_at", formatCreatedAt(process));
        item.put("createTime", formatCreatedAt(process));
        item.put("read", false);
        item.put("isRead", false);
        item.put("refId", process.getId());
        item.put("refType", "APPROVAL");
        return item;
    }

    private String toNotificationType(String processType) {
        if ("WORK_ORDER".equalsIgnoreCase(processType)) {
            return "work_order";
        }
        if ("RETIREMENT".equalsIgnoreCase(processType)
                || "ASSET_SCRAP".equalsIgnoreCase(processType)
                || "ASSET_CLEARANCE".equalsIgnoreCase(processType)) {
            return "retirement";
        }
        return "system_alert";
    }

    private String toNotificationCategory(String processType) {
        if ("WORK_ORDER".equalsIgnoreCase(processType)) {
            return "APPROVAL";
        }
        if ("RETIREMENT".equalsIgnoreCase(processType)
                || "ASSET_SCRAP".equalsIgnoreCase(processType)
                || "ASSET_CLEARANCE".equalsIgnoreCase(processType)) {
            return "ALERT";
        }
        return "SYSTEM";
    }

    private String buildTitle(ApprovalProcess process) {
        if (process.getProcessNo() != null && !process.getProcessNo().isBlank()) {
            return process.getProcessNo();
        }
        String type = process.getProcessType() == null ? "APPROVAL" : process.getProcessType();
        return type + "#" + process.getId();
    }

    private String buildContent(ApprovalProcess process) {
        String type = process.getProcessType() == null ? "审批" : process.getProcessType();
        return "您有一条" + type + "待处理";
    }

    private String formatCreatedAt(ApprovalProcess process) {
        LocalDateTime createdAt = process.getApplyTime() != null
                ? process.getApplyTime()
                : process.getCreateTime();
        return createdAt == null ? "" : createdAt.toString();
    }

    private Long getCurrentUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new BusinessException("未获取到当前用户");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new BusinessException("未获取到当前用户");
        }
        return userId;
    }
}
