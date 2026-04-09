package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.AssetClearanceDTO;
import com.ams.dto.AssetScrapDTO;
import com.ams.dto.AssetTransferDTO;
import com.ams.entity.Asset;
import com.ams.entity.AssetChangeLog;
import com.ams.service.DisposalService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/disposals")
public class DisposalController {

    private final DisposalService disposalService;

    public DisposalController(DisposalService disposalService) {
        this.disposalService = disposalService;
    }

    @PostMapping("/transfer")
    public Result<Asset> transfer(@Valid @RequestBody AssetTransferDTO dto) {
        return Result.success("转移成功", disposalService.transferAsset(dto));
    }

    @PostMapping("/clearance")
    public Result<Asset> clearance(@Valid @RequestBody AssetClearanceDTO dto) {
        return Result.success("清退成功", disposalService.clearAsset(dto));
    }

    @PostMapping("/scrap")
    public Result<Asset> scrap(@Valid @RequestBody AssetScrapDTO dto) {
        return Result.success("报废成功", disposalService.scrapAsset(dto));
    }

    @GetMapping("/history")
    public Result<Page<AssetChangeLog>> history(
        @RequestParam(defaultValue = "1") Integer page,
        @RequestParam(defaultValue = "10") Integer pageSize,
        @RequestParam(required = false) String changeType
    ) {
        return Result.success(disposalService.getDisposalHistory(page, pageSize, changeType));
    }
}
