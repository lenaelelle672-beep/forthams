package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.AssetAssignmentCreateDTO;
import com.ams.dto.AssetAssignmentQueryDTO;
import com.ams.dto.AssetAssignmentUpdateDTO;
import com.ams.entity.AssetAssignment;
import com.ams.service.AssetAssignmentService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * 领用归还 REST 控制器。
 */
@RestController
@RequestMapping("/assignments")
@RequiredArgsConstructor
public class AssetAssignmentController {

    private final AssetAssignmentService assignmentService;

    @PreAuthorize("@ss.hasPermi('asset:assignment:query')")
    @GetMapping
    public Result<Page<AssetAssignment>> list(AssetAssignmentQueryDTO queryDTO) {
        return Result.success(assignmentService.queryPage(queryDTO));
    }

    @PreAuthorize("@ss.hasPermi('asset:assignment:query')")
    @GetMapping("/{id}")
    public Result<AssetAssignment> getById(@PathVariable Long id) {
        return Result.success(assignmentService.getDetail(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:assignment:create')")
    @PostMapping
    public Result<AssetAssignment> create(@Valid @RequestBody AssetAssignmentCreateDTO dto) {
        return Result.success(assignmentService.create(dto));
    }

    @PreAuthorize("@ss.hasPermi('asset:assignment:edit')")
    @PutMapping("/{id}")
    public Result<AssetAssignment> update(@PathVariable Long id, @Valid @RequestBody AssetAssignmentUpdateDTO dto) {
        return Result.success(assignmentService.update(id, dto));
    }

    @PreAuthorize("@ss.hasPermi('asset:assignment:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        assignmentService.delete(id);
        return Result.success();
    }

    // ── 状态流转 ─────────────────────────────────────────────────────────────

    @PreAuthorize("@ss.hasPermi('asset:assignment:edit')")
    @PostMapping("/{id}/submit")
    public Result<AssetAssignment> submit(@PathVariable Long id) {
        return Result.success(assignmentService.submit(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:assignment:approve')")
    @PostMapping("/{id}/approve")
    public Result<AssetAssignment> approve(@PathVariable Long id) {
        return Result.success(assignmentService.approve(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:assignment:approve')")
    @PostMapping("/{id}/reject")
    public Result<AssetAssignment> reject(@PathVariable Long id, @RequestParam String reason) {
        return Result.success(assignmentService.reject(id, reason));
    }

    @PreAuthorize("@ss.hasPermi('asset:assignment:edit')")
    @PostMapping("/{id}/checkout")
    public Result<AssetAssignment> checkout(@PathVariable Long id) {
        return Result.success(assignmentService.checkout(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:assignment:edit')")
    @PostMapping("/{id}/return-request")
    public Result<AssetAssignment> returnRequest(@PathVariable Long id) {
        return Result.success(assignmentService.returnRequest(id));
    }

    @PreAuthorize("@ss.hasPermi('asset:assignment:approve')")
    @PostMapping("/{id}/approve-return")
    public Result<AssetAssignment> approveReturn(@PathVariable Long id, @RequestParam(required = false) String returnCondition) {
        return Result.success(assignmentService.approveReturn(id, returnCondition));
    }

    @PreAuthorize("@ss.hasPermi('asset:assignment:edit')")
    @PostMapping("/{id}/cancel")
    public Result<AssetAssignment> cancel(@PathVariable Long id) {
        return Result.success(assignmentService.cancel(id));
    }
}
