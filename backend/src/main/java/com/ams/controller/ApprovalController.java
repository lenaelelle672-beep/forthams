package com.ams.controller;

import com.ams.common.exception.BusinessException;
import com.ams.dto.ApprovalCreateDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.service.ApprovalService;
import com.ams.utils.JwtUtil;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;import com.ams.common.Result;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/approvals")
@RequiredArgsConstructor
public class ApprovalController {

    private final ApprovalService approvalService;
    private final JwtUtil jwtUtil;

    @GetMapping({"", "/list"})
    public Result<Page<ApprovalProcess>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(name = "processType", required = false) String processType,
            @RequestParam(required = false) String keyword) {
        // Use processType filter from the dedicated param; keyword is reserved
        // for future full-text search and is not passed as a processType filter.
        return Result.success(approvalService.queryProcesses(page, pageSize, status, processType));
    }

    @GetMapping("/{id}")
    public Result<?> getById(@PathVariable Long id) {
        return Result.success(approvalService.getProcessById(id));
    }

    @PostMapping
    public Result<ApprovalProcess> create(@Valid @RequestBody ApprovalCreateDTO dto, HttpServletRequest request) {
        dto.setApplicantId(getCurrentUserId(request));
        return Result.success(approvalService.createProcess(dto));
    }

    @PostMapping("/{id}/approve")
    public Result<ApprovalProcess> approve(@PathVariable Long id, @RequestBody Map<String, Object> body,
                                           HttpServletRequest request) {
        String result = (String) body.getOrDefault("result", "APPROVED");
        String opinion = (String) body.getOrDefault("opinion", "");
        return Result.success(approvalService.approve(id, getCurrentUserId(request), result, opinion));
    }

    @PostMapping("/{id}/cancel")
    public Result<ApprovalProcess> cancel(@PathVariable Long id, HttpServletRequest request) {
        return Result.success(approvalService.cancelProcess(id, getCurrentUserId(request)));
    }

    @GetMapping("/pending")
    public Result<?> pending(HttpServletRequest request) {
        return Result.success(approvalService.getMyPendingApprovals(getCurrentUserId(request)));
    }

    @GetMapping("/pending/count")
    public Result<Long> pendingCount() {
        return Result.success(approvalService.getPendingCount());
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
