package com.ams.controller;

import com.ams.common.exception.BusinessException;
import com.ams.dto.ApprovalCreateDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.service.ApprovalService;
import com.ams.utils.JwtUtil;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import com.ams.common.Result;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/approvals")
@RequiredArgsConstructor
public class ApprovalController {

    private final ApprovalService approvalService;
    private final JwtUtil jwtUtil;

    /** 列表查询（支持 GET /approvals 和 GET /approvals/list 两个路径） */
    @GetMapping({"", "/list"})
    public Result<Page<ApprovalProcess>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(name = "processType", required = false) String processType,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long applicantId,
            HttpServletRequest request) {
        // mine=true 时自动使用当前登录用户作为发起人过滤
        String mine = request.getParameter("mine");
        if ("true".equals(mine) && applicantId == null) {
            applicantId = getCurrentUserId(request);
        }
        return Result.success(approvalService.queryProcesses(page, pageSize, status, processType, applicantId));
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

    /** 驳回审批 */
    @PostMapping("/{id}/reject")
    public Result<ApprovalProcess> reject(@PathVariable Long id, @RequestBody Map<String, Object> body,
                                          HttpServletRequest request) {
        String opinion = (String) body.getOrDefault("rejectionReason",
                         body.getOrDefault("comment", body.getOrDefault("reason", "")));
        return Result.success(approvalService.approve(id, getCurrentUserId(request), "REJECTED", opinion));
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

    /** 流程统计：按 processType 分组返回各流程的总数/通过数/驳回数/审批中数 */
    @GetMapping("/stats")
    public Result<List<Map<String, Object>>> stats() {
        return Result.success(approvalService.getProcessTypeStats());
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
