package com.ams.controller;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.ams.entity.ApprovalProcess;
import com.ams.service.ApprovalService;
import com.ams.utils.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final ApprovalService approvalService;
    private final JwtUtil jwtUtil;

    /**
     * 分页查询通知列表。
     * 当前基于审批流程派生，TODO: 后续实现独立通知表和 NotificationService。
     */
    @GetMapping
    public Result<Map<String, Object>> list(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            HttpServletRequest request) {
        Long userId = getCurrentUserId(request);
        List<Map<String, Object>> allItems = approvalService.getMyPendingApprovals(userId)
                .stream()
                .map(this::toNotificationItem)
                .filter(item -> type == null || type.isBlank() || type.equals(item.get("type")))
                .filter(item -> category == null || category.isBlank() || category.equals(item.get("category")))
                .toList();

        int total = allItems.size();
        int fromIndex = Math.min((page - 1) * pageSize, total);
        int toIndex = Math.min(fromIndex + pageSize, total);
        List<Map<String, Object>> records = allItems.subList(fromIndex, toIndex);

        Map<String, Object> pageData = new LinkedHashMap<>();
        pageData.put("records", records);
        pageData.put("total", total);
        pageData.put("size", pageSize);
        pageData.put("current", page);
        pageData.put("pages", (int) Math.ceil((double) total / pageSize));
        return Result.success(pageData);
    }

    @GetMapping("/pending")
    public Result<Map<String, Object>> pending(
            @RequestParam(required = false) String type,
            HttpServletRequest request) {
        Long userId = getCurrentUserId(request);
        List<Map<String, Object>> items = approvalService.getMyPendingApprovals(userId)
                .stream()
                .map(this::toNotificationItem)
                .filter(item -> type == null || type.isBlank() || type.equals(item.get("type")))
                .toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("unread_count", items.size());
        response.put("items", items);
        return Result.success(response);
    }

    @GetMapping("/pending/count")
    public Result<Integer> pendingCount(HttpServletRequest request) {
        Long userId = getCurrentUserId(request);
        return Result.success(approvalService.getMyPendingApprovals(userId).size());
    }

    /**
     * 标记单条通知为已读。
     * TODO: 实现独立通知表后支持真实已读状态更新。
     */
    @PutMapping("/{id}/read")
    public Result<Void> markAsRead(@PathVariable Long id, HttpServletRequest request) {
        // TODO: 更新 notification 表的 read 状态
        return Result.success();
    }

    /**
     * 全部标记为已读。
     * TODO: 实现独立通知表后支持批量已读。
     */
    @PutMapping("/read-all")
    public Result<Void> markAllAsRead(HttpServletRequest request) {
        // TODO: 批量更新当前用户所有通知为已读
        return Result.success();
    }

    /**
     * 删除通知。
     * TODO: 实现独立通知表后支持真实删除。
     */
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id, HttpServletRequest request) {
        // TODO: 从 notification 表删除记录
        return Result.success();
    }

    private Map<String, Object> toNotificationItem(ApprovalProcess process) {
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
