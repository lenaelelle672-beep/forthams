package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.ApprovalCreateDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.service.ApprovalService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
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
            @RequestParam(required = false) String processType) {
        return Result.success(approvalService.queryProcesses(page, pageSize, status, processType));
    }

    @GetMapping("/pending")
    public Result<Page<ApprovalProcess>> pending(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(approvalService.queryProcesses(page, pageSize, "PENDING", null));
    }

    @GetMapping("/{id}")
    public Result<Map<String, Object>> getById(@PathVariable Long id) {
        return Result.success(approvalService.getProcessById(id));
    }

    @PostMapping
    public Result<ApprovalProcess> create(@RequestBody ApprovalCreateDTO dto) {
        return Result.success(approvalService.createProcess(dto));
    }

    @PostMapping("/{id}/approve")
    public Result<ApprovalProcess> approve(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return Result.success(approvalService.approve(id, 1L, body.get("result"), body.get("opinion")));
    }
}
