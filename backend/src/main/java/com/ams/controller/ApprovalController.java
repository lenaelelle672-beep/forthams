package com.ams.controller;

import cn.hutool.core.bean.BeanUtil;
import com.ams.common.Result;
import com.ams.dto.ApprovalActionDTO;
import com.ams.dto.ApprovalCreateDTO;
import com.ams.entity.ApprovalProcess;
import com.ams.service.ApprovalService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
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
        @RequestParam(required = false) String processType
    ) {
        return Result.success(approvalService.queryProcesses(page, pageSize, status, processType));
    }

    @GetMapping("/{id}")
    public Result<Map<String, Object>> getById(@PathVariable Long id) {
        return Result.success(approvalService.getProcessById(id));
    }

    @PostMapping
    public Result<ApprovalProcess> create(@Valid @RequestBody ApprovalCreateDTO dto) {
        return Result.success("创建成功", approvalService.createProcess(dto));
    }

    @PostMapping("/{id}/approve")
    public Result<ApprovalProcess> approve(
        @PathVariable Long id,
        @RequestParam Long approverId,
        @Valid @RequestBody ApprovalActionDTO dto
    ) {
        return Result.success(
            "审批完成",
            approvalService.approve(
                id,
                approverId,
                BeanUtil.getProperty(dto, "approveResult"),
                BeanUtil.getProperty(dto, "approveOpinion")
            )
        );
    }

    @GetMapping("/pending")
    public Result<List<ApprovalProcess>> getPending(@RequestParam Long approverId) {
        return Result.success(approvalService.getMyPendingApprovals(approverId));
    }

    @GetMapping("/pending/count")
    public Result<Long> getPendingCount() {
        return Result.success(approvalService.getPendingCount());
    }
}
