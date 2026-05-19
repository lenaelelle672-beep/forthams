package com.ams.controller;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.ams.entity.ApprovalProcess;
import com.ams.service.ApprovalService;
import com.ams.utils.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final ApprovalService approvalService;
    private final JwtUtil jwtUtil;

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

    private Map<String, Object> toNotificationItem(ApprovalProcess process) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", process.getId());
        item.put("type", toNotificationType(process.getProcessType()));
        item.put("title", buildTitle(process));
        item.put("created_at", formatCreatedAt(process));
        item.put("read", false);
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

    private String buildTitle(ApprovalProcess process) {
        if (process.getProcessNo() != null && !process.getProcessNo().isBlank()) {
            return process.getProcessNo();
        }
        String type = process.getProcessType() == null ? "APPROVAL" : process.getProcessType();
        return type + "#" + process.getId();
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
