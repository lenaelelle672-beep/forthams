package com.ams.controller;

import com.ams.common.Result;
import com.ams.entity.Insurance;
import com.ams.entity.InsuranceClaim;
import com.ams.service.InsuranceService;
import com.ams.service.InsuranceClaimService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/insurance")
@RequiredArgsConstructor
public class InsuranceController {
    private final InsuranceService insuranceService;
    private final InsuranceClaimService claimService;

    @PreAuthorize("@ss.hasPermi('insurance:list:query')")
    @GetMapping({"", "/list"})
    public Result<Page<Insurance>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String insuranceType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd") LocalDate endDate,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(insuranceService.listInsurance(keyword, insuranceType, status, startDate, endDate, pageNum, pageSize));
    }

    @PreAuthorize("@ss.hasPermi('insurance:list:query')")
    @GetMapping("/{id}")
    public Result<Insurance> getById(@PathVariable Long id) {
        return Result.success(insuranceService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('insurance:list:add')")
    @PostMapping
    public Result<Insurance> create(@Valid @RequestBody Insurance insurance) {
        return Result.success(insuranceService.create(insurance));
    }

    @PreAuthorize("@ss.hasPermi('insurance:list:edit')")
    @PutMapping("/{id}")
    public Result<Insurance> update(@PathVariable Long id, @Valid @RequestBody Insurance insurance) {
        return Result.success(insuranceService.update(id, insurance));
    }

    @PreAuthorize("@ss.hasPermi('insurance:list:remove')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        insuranceService.delete(id);
        return Result.success();
    }

    @GetMapping("/upcoming-expirations")
    public Result<List<Insurance>> getExpiringPolicies(@RequestParam(defaultValue = "30") Integer days) {
        return Result.success(insuranceService.getExpiringPolicies(days));
    }

    @GetMapping("/assets/{assetId}/total-premium")
    public Result<BigDecimal> getTotalPremiumByAssetId(@PathVariable Long assetId) {
        return Result.success(insuranceService.getTotalPremiumByAssetId(assetId));
    }

    @GetMapping("/{insuranceId}/claims")
    public Result<Page<InsuranceClaim>> getClaims(
            @PathVariable Long insuranceId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(claimService.listClaims(insuranceId, status, pageNum, pageSize));
    }

    @GetMapping("/claims/{id}")
    public Result<InsuranceClaim> getClaimById(@PathVariable Long id) {
        return Result.success(claimService.getById(id));
    }

    @PreAuthorize("@ss.hasPermi('insurance:claims:add')")
    @PostMapping("/claims")
    public Result<InsuranceClaim> createClaim(@Valid @RequestBody InsuranceClaim claim) {
        return Result.success(claimService.create(claim));
    }

    @PreAuthorize("@ss.hasPermi('insurance:claims:edit')")
    @PutMapping("/claims/{id}")
    public Result<InsuranceClaim> updateClaim(@PathVariable Long id, @Valid @RequestBody InsuranceClaim claim) {
        return Result.success(claimService.update(id, claim));
    }

    @PreAuthorize("@ss.hasPermi('insurance:claims:remove')")
    @DeleteMapping("/claims/{id}")
    public Result<Void> deleteClaim(@PathVariable Long id) {
        claimService.delete(id);
        return Result.success();
    }
}