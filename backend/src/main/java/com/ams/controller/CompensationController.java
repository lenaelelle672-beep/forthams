package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.CompensationCreateDTO;
import com.ams.dto.CompensationUpdateDTO;
import com.ams.entity.AssetCompensation;
import com.ams.service.CompensationService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/compensations")
@RequiredArgsConstructor
public class CompensationController {

    private final CompensationService compensationService;

    @Auditable
    @GetMapping("/list")
    public Result<Page<AssetCompensation>> list(
        @RequestParam(defaultValue = "1") Integer page,
        @RequestParam(defaultValue = "10") Integer pageSize,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) Long assetId
    ) {
        return Result.success(compensationService.queryCompensations(page, pageSize, status, assetId));
    }

    @Auditable
    @Auditable
    @GetMapping("/{id}")
    public Result<AssetCompensation> getById(@PathVariable Long id) {
        return Result.success(compensationService.getById(id));
    }

    @Auditable
    @Auditable
    @PostMapping
    public Result<AssetCompensation> create(@Valid @RequestBody CompensationCreateDTO dto) {
        return Result.success("创建成功", compensationService.createCompensation(dto));
    }

    @Auditable
    @Auditable
    @PutMapping("/{id}")
    public Result<AssetCompensation> update(@PathVariable Long id, @RequestBody CompensationUpdateDTO dto) {
        return Result.success("更新成功", compensationService.updateCompensation(id, dto));
    }

    @Auditable
    @Auditable
    @PutMapping("/{id}/status")
    public Result<AssetCompensation> updateStatus(@PathVariable Long id, @RequestParam String status) {
        return Result.success("状态更新成功", compensationService.updateStatus(id, status));
    }

    @Auditable
    @Auditable
    @DeleteMapping("/{id}")
    public Result<String> delete(@PathVariable Long id) {
        compensationService.deleteCompensation(id);
        return Result.success("删除成功");
    }
}
