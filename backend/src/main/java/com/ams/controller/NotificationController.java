package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.ApprovalProcess;
import com.ams.entity.NotificationRecord;
import com.ams.entity.User;
import com.ams.mapper.UserMapper;
import com.ams.service.ApprovalService;
import com.ams.service.NotificationService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

import java.time.LocalDateTime;
import java.util.*;

/**
 * 通知中心控制器
 *
 * <p>提供通知的 CRUD 端点，基于独立的 notification 表持久化。
 * 保留 /pending 兼容端点，从 ApprovalService 派生。</p>
 */
@Slf4j
@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final ApprovalService approvalService;
    private final UserMapper userMapper;

    /**
     * 分页查询通知列表。
     * 从独立 notification 表查询，支持按 type/category 过滤。
     */
    @PreAuthorize("@ss.hasPermi('notification:query')")
    @GetMapping
    public Result<Map<String, Object>> list(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        Long userId = getCurrentUserId();
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
    @PreAuthorize("@ss.hasPermi('notification:query')")
    @GetMapping("/unread-count")
    public Result<Long> unreadCount() {
        Long userId = getCurrentUserId();
        return Result.success(notificationService.getUnreadCount(userId));
    }

    /**
     * 兼容旧端点：获取待处理通知列表（从审批流程派生）。
     */
    @PreAuthorize("@ss.hasPermi('notification:query')")
    @GetMapping("/pending")
    public Result<Map<String, Object>> pending(
            @RequestParam(required = false) String type) {
        Long userId = getCurrentUserId();
        List<Map<String, Object>> items = approvalService.getMyPendingApprovals(userId, new Page<>(1, 20))
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
    @PreAuthorize("@ss.hasPermi('notification:query')")
    @GetMapping("/pending/count")
    public Result<Long> pendingCount() {
        Long userId = getCurrentUserId();
        // 优先返回真实未读数
        return Result.success(notificationService.getUnreadCount(userId));
    }

    /**
     * 标记单条通知为已读。
     */
    @PreAuthorize("@ss.hasPermi('notification:read')")
    @PutMapping("/{id}/read")
    public Result<Void> markAsRead(@PathVariable Long id) {
        Long userId = getCurrentUserId();
        notificationService.markAsRead(id, userId);
        return Result.success();
    }

    /**
     * 全部标记为已读。
     */
    @PreAuthorize("@ss.hasPermi('notification:read')")
    @PutMapping("/read-all")
    public Result<Void> markAllAsRead() {
        Long userId = getCurrentUserId();
        notificationService.markAllAsRead(userId);
        return Result.success();
    }

    /**
     * 删除通知。
     */
    @PreAuthorize("@ss.hasPermi('notification:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        Long userId = getCurrentUserId();
        notificationService.delete(id, userId);
        return Result.success();
    }

    // ==================== 私有方法 ====================

    /**
     * 从 Spring Security SecurityContext 中获取当前认证用户的数据库 ID。
     */
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
}
