package com.ams.controller;

import com.ams.dto.ApprovalCreateDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.service.ApprovalService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/approvals")
@RequiredArgsConstructor
public class ApprovalController {

    private final ApprovalService approvalService;

    @GetMapping("/list")
    public Result<Page<ApprovalProcess>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return Result.success(approvalService.queryProcesses(page, pageSize, status, keyword));
    }

    @GetMapping("/{id}")
    public Result<?> getById(@PathVariable Long id) {
        return Result.success(approvalService.getProcessById(id));
    }

    @PostMapping
    public Result<ApprovalProcess> create(@RequestBody ApprovalCreateDTO dto) {
        return Result.success(approvalService.createProcess(dto));
    }

    @PostMapping("/{id}/approve")
    public Result<ApprovalProcess> approve(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String result = (String) body.getOrDefault("result", "APPROVED");
        String opinion = (String) body.getOrDefault("opinion", "");
        return Result.success(approvalService.approve(id, 1L, result, opinion));
    }

    @GetMapping("/pending")
    public Result<?> pending() {
        return Result.success(approvalService.getMyPendingApprovals(1L));
    }

    @GetMapping("/pending/count")
    public Result<Long> pendingCount() {
        return Result.success(approvalService.getPendingCount());
    }
}
