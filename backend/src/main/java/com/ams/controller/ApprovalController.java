package com.ams.controller;

import com.ams.annotation.OperBusinessType;
import com.ams.annotation.OperLog;
import com.ams.common.exception.BusinessException;
import com.ams.common.Result;
import com.ams.dto.ApprovalActionDTO;
import com.ams.dto.ApprovalCreateDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.service.ApprovalService;
import com.ams.utils.JwtUtil;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
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
    @PreAuthorize("@ss.hasPermi('approval:process:query')")
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
        return Result.success(approvalService.queryProcesses(page, pageSize, status, processType, applicantId, keyword));
    }

    @PreAuthorize("@ss.hasPermi('approval:process:query')")
    @GetMapping("/{id}")
    public Result<?> getById(@PathVariable Long id) {
        return Result.success(approvalService.getProcessById(id));
    }

    @PreAuthorize("@ss.hasPermi('approval:process:create')")
    @OperLog(title = "审批发起", businessType = OperBusinessType.INSERT)
    @PostMapping
    public Result<ApprovalProcess> create(@Valid @RequestBody ApprovalCreateDTO dto, HttpServletRequest request) {
        dto.setApplicantId(getCurrentUserId(request));
        return Result.success(approvalService.createProcess(dto));
    }

    @PreAuthorize("@ss.hasPermi('approval:process:approve')")
    @OperLog(title = "审批通过", businessType = OperBusinessType.UPDATE)
    @PostMapping("/{id}/approve")
    public Result<ApprovalProcess> approve(@PathVariable Long id, @Valid @RequestBody ApprovalActionDTO dto,
                                           HttpServletRequest request) {
        return Result.success(approvalService.approve(id, getCurrentUserId(request), dto.getResult(), dto.getOpinion()));
    }

    /** 驳回审批 */
    @PreAuthorize("@ss.hasPermi('approval:process:reject')")
    @OperLog(title = "审批驳回", businessType = OperBusinessType.UPDATE)
    @PostMapping("/{id}/reject")
    public Result<ApprovalProcess> reject(@PathVariable Long id, @Valid @RequestBody ApprovalActionDTO dto,
                                          HttpServletRequest request) {
        return Result.success(approvalService.approve(id, getCurrentUserId(request), "REJECTED", dto.getOpinion()));
    }

    @PreAuthorize("@ss.hasPermi('approval:process:cancel')")
    @OperLog(title = "审批取消", businessType = OperBusinessType.UPDATE)
    @PostMapping("/{id}/cancel")
    public Result<ApprovalProcess> cancel(@PathVariable Long id, HttpServletRequest request) {
        return Result.success(approvalService.cancelProcess(id, getCurrentUserId(request)));
    }

    @PreAuthorize("@ss.hasPermi('approval:process:query')")
    @GetMapping("/pending")
    public Result<?> pending(HttpServletRequest request) {
        return Result.success(approvalService.getMyPendingApprovals(getCurrentUserId(request), new Page<>(1, 20)));
    }

    /** 流程统计：按 processType 分组返回各流程的总数/通过数/驳回数/审批中数 */
    @PreAuthorize("@ss.hasPermi('approval:process:query')")
    @GetMapping("/stats")
    public Result<List<Map<String, Object>>> stats() {
        return Result.success(approvalService.getProcessTypeStats());
    }

    @PreAuthorize("@ss.hasPermi('approval:process:query')")
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
