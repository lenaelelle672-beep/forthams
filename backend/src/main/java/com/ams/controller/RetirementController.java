package com.ams.controller;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.ams.dto.RetirementActionRequestDTO;
import com.ams.dto.RetirementApplyDTO;
import com.ams.dto.RetirementRejectRequestDTO;
import com.ams.entity.RetirementApplication;
import com.ams.service.RetirementApplicationService;
import com.ams.utils.JwtUtil;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import jakarta.validation.constraints.Positive;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/v1/retirement", "/retirement"})
@RequiredArgsConstructor
@Validated
public class RetirementController {

    private final RetirementApplicationService retirementApplicationService;
    private final JwtUtil jwtUtil;

    @PostMapping("/apply")
    @PreAuthorize("hasAuthority('retirement:create')")
    @ResponseStatus(HttpStatus.CREATED)
    public Result<RetirementApplication> submitApplication(@Valid @RequestBody RetirementApplyDTO dto,
                                                             HttpServletRequest request) {
        return Result.success(retirementApplicationService.submitApplication(dto, getCurrentUserId(request)));
    }

    @PostMapping("/applications")
    @PreAuthorize("hasAuthority('retirement:create')")
    @ResponseStatus(HttpStatus.CREATED)
    public Result<RetirementApplication> createApplication(@Valid @RequestBody RetirementApplyDTO dto,
                                                             HttpServletRequest request) {
        return submitApplication(dto, request);
    }

    @PostMapping({"/draft", "/applications/draft"})
    @PreAuthorize("hasAuthority('retirement:create')")
    @ResponseStatus(HttpStatus.CREATED)
    public Result<RetirementApplication> createDraftApplication(@Valid @RequestBody RetirementApplyDTO dto,
                                                                 HttpServletRequest request) {
        return Result.success(retirementApplicationService.createDraftApplication(dto, getCurrentUserId(request)));
    }

    @PostMapping({"/{id}/submit", "/applications/{id}/submit"})
    @PreAuthorize("hasAuthority('retirement:update')")
    public Result<RetirementApplication> submitExistingApplication(@PathVariable @Positive Long id, HttpServletRequest request) {
        return Result.success(retirementApplicationService.submitExistingApplication(id, getCurrentUserId(request)));
    }

    @GetMapping("/my-applications")
    @PreAuthorize("hasAuthority('retirement:query')")
    public Result<Page<RetirementApplication>> getMyApplications(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            HttpServletRequest request) {
        return Result.success(retirementApplicationService.getMyApplications(getCurrentUserId(request), page, pageSize));
    }

    @GetMapping("/applications")
    @PreAuthorize("hasAuthority('retirement:query')")
    public Result<Page<RetirementApplication>> getApplications(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long assetId,
            @RequestParam(name = "asset_id", required = false) Long assetIdAlias) {
        return Result.success(retirementApplicationService.queryApplications(
                page,
                pageSize,
                status,
                assetId != null ? assetId : assetIdAlias));
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAuthority('retirement:query')")
    public Result<List<RetirementApplication>> getPendingApplications() {
        return Result.success(retirementApplicationService.queryApplications(1, 100, "PENDING", null).getRecords());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('retirement:query')")
    public Result<RetirementApplication> getApplicationById(@PathVariable @Positive Long id) {
        return Result.success(retirementApplicationService.getApplicationById(id));
    }

    @GetMapping("/applications/{id}")
    @PreAuthorize("hasAuthority('retirement:query')")
    public Result<RetirementApplication> getApplicationAlias(@PathVariable @Positive Long id) {
        return getApplicationById(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('retirement:update')")
    public Result<RetirementApplication> updateApplication(@PathVariable @Positive Long id,
                                                            @Valid @RequestBody RetirementApplyDTO dto) {
        return Result.success(retirementApplicationService.updateApplication(id, dto));
    }

    @PutMapping("/applications/{id}")
    @PreAuthorize("hasAuthority('retirement:update')")
    public Result<RetirementApplication> updateApplicationAlias(@PathVariable @Positive Long id,
                                                                 @Valid @RequestBody RetirementApplyDTO dto) {
        return updateApplication(id, dto);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('retirement:delete')")
    public Result<Void> cancelApplication(@PathVariable @Positive Long id, HttpServletRequest request) {
        retirementApplicationService.cancelApplication(id, getCurrentUserId(request));
        return Result.success();
    }

    @PostMapping({"/{id}/cancel", "/applications/{id}/cancel"})
    @PreAuthorize("hasAuthority('retirement:delete')")
    public Result<RetirementApplication> cancelApplicationAlias(@PathVariable @Positive Long id, HttpServletRequest request) {
        retirementApplicationService.cancelApplication(id, getCurrentUserId(request));
        return Result.success(retirementApplicationService.getApplicationById(id));
    }

    @PostMapping({"/{id}/approve", "/applications/{id}/approve"})
    @PreAuthorize("hasAuthority('retirement:approve')")
    public Result<RetirementApplication> approveApplication(@PathVariable @Positive Long id, HttpServletRequest request) {
        throw directApprovalDisabled();
    }

    @PostMapping({"/{id}/complete", "/applications/{id}/complete"})
    @PreAuthorize("hasAuthority('retirement:approve')")
    public Result<RetirementApplication> completeApplication(@PathVariable @Positive Long id, HttpServletRequest request) {
        throw directApprovalDisabled();
    }

    @PostMapping({"/{id}/reject", "/applications/{id}/reject"})
    @PreAuthorize("hasAuthority('retirement:approve')")
    public Result<RetirementApplication> rejectApplication(@PathVariable @Positive Long id,
                                                             @Valid @RequestBody(required = false) RetirementRejectRequestDTO body,
                                                             HttpServletRequest request) {
        throw directApprovalDisabled();
    }

    @PostMapping("/approve")
    @PreAuthorize("hasAuthority('retirement:approve')")
    public Result<RetirementApplication> approveApplicationByBody(
                                                                     @Valid @RequestBody RetirementActionRequestDTO body,
                                                                     HttpServletRequest request) {
        throw directApprovalDisabled();
    }

    @PostMapping("/complete")
    @PreAuthorize("hasAuthority('retirement:approve')")
    public Result<RetirementApplication> completeApplicationByBody(
                                                                      @Valid @RequestBody RetirementActionRequestDTO body,
                                                                     HttpServletRequest request) {
        throw directApprovalDisabled();
    }

    @PostMapping("/reject")
    @PreAuthorize("hasAuthority('retirement:approve')")
    public Result<RetirementApplication> rejectApplicationByBody(
                                                                    @Valid @RequestBody RetirementActionRequestDTO body,
                                                                   HttpServletRequest request) {
        throw directApprovalDisabled();
    }

    @GetMapping("/asset/{assetId}")
    @PreAuthorize("hasAuthority('retirement:query')")
    public Result<List<RetirementApplication>> getAssetRetirementHistory(@PathVariable @Positive Long assetId) {
        return Result.success(retirementApplicationService.getAssetRetirementHistory(assetId));
    }

    @GetMapping("/list")
    @PreAuthorize("hasAuthority('retirement:query')")
    public Result<?> getApplicationList(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long assetId,
            @RequestParam(name = "asset_id", required = false) Long assetIdAlias) {
        Long resolvedAssetId = assetId != null ? assetId : assetIdAlias;
        if (resolvedAssetId != null) {
            return Result.success(retirementApplicationService.getAssetRetirementHistory(resolvedAssetId));
        }
        return Result.success(retirementApplicationService.queryApplications(page, pageSize, status, null));
    }

    @GetMapping("/statistics")
    @PreAuthorize("hasAuthority('retirement:query')")
    public Result<Map<String, Object>> getStatistics() {
        return Result.success(retirementApplicationService.getStatistics());
    }

    private Long getCurrentUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new BusinessException("未获取到当前用户");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new BusinessException("未获取到当前用户");
        }
        return userId;
    }

    private AccessDeniedException directApprovalDisabled() {
        return new AccessDeniedException("退役终态必须通过受控审批流程处理");
    }

}
