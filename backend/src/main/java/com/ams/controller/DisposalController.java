package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.AssetClearanceDTO;
import com.ams.dto.AssetScrapDTO;
import com.ams.dto.AssetTransferDTO;
import com.ams.entity.AssetChangeLog;
import com.ams.entity.DisposalApplication;
import com.ams.enums.DisposalType;
import com.ams.service.DisposalService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import jakarta.validation.constraints.Positive;

import java.util.Map;

@RestController
@RequestMapping("/disposals")
@Validated
public class DisposalController {

    private final DisposalService disposalService;

    public DisposalController(DisposalService disposalService) {
        this.disposalService = disposalService;
    }

    @PostMapping("/transfer")
    @PreAuthorize("hasAuthority('disposal:create')")
    @ResponseStatus(HttpStatus.CREATED)
    public Result<DisposalApplication> transfer(@Valid @RequestBody AssetTransferDTO dto) {
        return Result.success("处置申请已创建，等待审批", disposalService.createTransferApplication(dto));
    }

    @PostMapping("/clearance")
    @PreAuthorize("hasAuthority('disposal:create')")
    @ResponseStatus(HttpStatus.CREATED)
    public Result<DisposalApplication> clearance(@Valid @RequestBody AssetClearanceDTO dto) {
        return Result.success("处置申请已创建，等待审批", disposalService.createClearanceApplication(dto));
    }

    @PostMapping("/scrap")
    @PreAuthorize("hasAuthority('disposal:create')")
    @ResponseStatus(HttpStatus.CREATED)
    public Result<DisposalApplication> scrap(@Valid @RequestBody AssetScrapDTO dto) {
        return Result.success("处置申请已创建，等待审批", disposalService.createScrapApplication(dto));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('disposal:query')")
    public Result<Page<DisposalApplication>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) DisposalType disposalType,
            @RequestParam(required = false) com.ams.enums.DisposalStatus status,
            @RequestParam(required = false) String keyword) {
        return Result.success(disposalService.queryApplications(page, pageSize, disposalType, status, keyword));
    }

    @GetMapping("/statistics")
    @PreAuthorize("hasAuthority('disposal:query')")
    public Result<Map<String, Long>> statistics() {
        return Result.success(disposalService.getDisposalStatistics());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('disposal:query')")
    public Result<DisposalApplication> getById(@PathVariable @Positive Long id) {
        return Result.success(disposalService.getApplicationDetail(id));
    }

    @GetMapping("/history")
    @PreAuthorize("hasAuthority('disposal:query')")
    public Result<Page<AssetChangeLog>> history(
        @RequestParam(defaultValue = "1") Integer page,
        @RequestParam(defaultValue = "10") Integer pageSize,
        @RequestParam(required = false) DisposalType changeType
    ) {
        return Result.success(disposalService.getDisposalHistory(page, pageSize, changeType));
    }
}
