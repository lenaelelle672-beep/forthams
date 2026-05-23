package com.ams.controller;

import com.ams.common.exception.BusinessException;
import com.ams.dto.CompensationCreateDTO;
import com.ams.dto.CompensationUpdateDTO;
import com.ams.dto.CompensationValuationDTO;
import com.ams.entity.AssetCompensation;
import com.ams.service.CompensationService;
import jakarta.validation.Valid;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping({"/compensation", "/compensations"})
@RequiredArgsConstructor
public class CompensationController {

    private final CompensationService compensationService;

    @GetMapping("/list")
    public Result<Page<AssetCompensation>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(compensationService.queryCompensations(page, pageSize, null, null));
    }

    @GetMapping("/{id}")
    public Result<AssetCompensation> getById(@PathVariable Long id) {
        return Result.success(compensationService.getById(id));
    }

    @PostMapping
    public Result<AssetCompensation> create(@Valid @RequestBody CompensationCreateDTO dto) {
        throw new BusinessException("资产赔偿必须通过审批流程提交");
    }

    @PostMapping("/valuation")
    public Result<CompensationValuationDTO> valuation(@Valid @RequestBody CompensationCreateDTO dto) {
        return Result.success(compensationService.estimateCompensation(dto));
    }

    @PutMapping("/{id}")
    public Result<AssetCompensation> update(@PathVariable Long id, @Valid @RequestBody CompensationUpdateDTO dto) {
        return Result.success(compensationService.updateCompensation(id, dto));
    }

    @PutMapping("/{id}/status")
    public Result<AssetCompensation> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        throw new BusinessException("赔偿状态必须由审批流程回写");
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        compensationService.deleteCompensation(id);
        return Result.success();
    }
}
