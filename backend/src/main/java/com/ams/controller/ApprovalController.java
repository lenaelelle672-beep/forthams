package com.ams.controller;

import com.ams.common.exception.BusinessException;
import com.ams.dto.ApprovalCreateDTO;
import com.ams.dto.ApprovalDecisionDTO;
import com.ams.dto.ApprovalRecoveryDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.service.ApprovalService;
import com.ams.utils.JwtUtil;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.constraints.Positive;

@RestController
@RequestMapping("/approvals")
@RequiredArgsConstructor
@Validated
public class ApprovalController {

    private final ApprovalService approvalService;
    private final JwtUtil jwtUtil;

    @GetMapping("/list")
    @PreAuthorize("hasAuthority('approval:query')")
    public Result<Page<ApprovalProcess>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String processType) {
        return Result.success(approvalService.queryProcesses(page, pageSize, status, processType));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('approval:query')")
    public Result<?> getById(@PathVariable @Positive Long id) {
        return Result.success(approvalService.getProcessById(id));
    }

    @GetMapping("/{id}/recovery")
    @PreAuthorize("hasAuthority('approval:query')")
    public Result<ApprovalRecoveryDTO> recovery(@PathVariable @Positive Long id) {
        return Result.success(approvalService.getRecoveryGuidance(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('approval:create')")
    public Result<ApprovalProcess> create(@Valid @RequestBody ApprovalCreateDTO dto, HttpServletRequest request) {
        dto.setApplicantId(getCurrentUserId(request));
        return Result.success(approvalService.createProcess(dto));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAuthority('approval:approve')")
    public Result<ApprovalProcess> approve(@PathVariable @Positive Long id, @Valid @RequestBody ApprovalDecisionDTO body,
                                            HttpServletRequest request) {
        return Result.success(approvalService.approve(
                id, getCurrentUserId(request), body.getResult().name(), body.getOpinion()));
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAuthority('approval:query')")
    public Result<?> pending(HttpServletRequest request) {
        return Result.success(approvalService.getMyPendingApprovals(getCurrentUserId(request)));
    }

    @GetMapping("/pending/count")
    @PreAuthorize("hasAuthority('approval:query')")
    public Result<Long> pendingCount(HttpServletRequest request) {
        return Result.success(approvalService.getPendingCount(getCurrentUserId(request)));
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
