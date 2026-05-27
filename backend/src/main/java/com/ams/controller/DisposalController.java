package com.ams.controller;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.ams.dto.AssetClearanceDTO;
import com.ams.dto.AssetScrapDTO;
import com.ams.dto.AssetTransferDTO;
import com.ams.entity.Asset;
import com.ams.entity.AssetChangeLog;
import com.ams.service.DisposalService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/disposals")
public class DisposalController {

    private final DisposalService disposalService;

    public DisposalController(DisposalService disposalService) {
        this.disposalService = disposalService;
    }

    @PreAuthorize("@ss.hasPermi('disposal:transfer')")
    @PostMapping("/transfer")
    public Result<Asset> transfer(@Valid @RequestBody AssetTransferDTO dto) {
        throw new BusinessException("资产转移必须通过审批流程提交");
    }

    @PreAuthorize("@ss.hasPermi('disposal:clearance')")
    @PostMapping("/clearance")
    public Result<Asset> clearance(@Valid @RequestBody AssetClearanceDTO dto) {
        throw new BusinessException("资产清退必须通过审批流程提交");
    }

    @PreAuthorize("@ss.hasPermi('disposal:scrap')")
    @PostMapping("/scrap")
    public Result<Asset> scrap(@Valid @RequestBody AssetScrapDTO dto) {
        throw new BusinessException("资产报废必须通过审批流程提交");
    }

    @PreAuthorize("@ss.hasPermi('disposal:query')")
    @GetMapping("/history")
    public Result<Page<AssetChangeLog>> history(
        @RequestParam(defaultValue = "1") Integer page,
        @RequestParam(defaultValue = "10") Integer pageSize,
        @RequestParam(required = false) String changeType
    ) {
        return Result.success(disposalService.getDisposalHistory(page, pageSize, changeType));
    }
}
