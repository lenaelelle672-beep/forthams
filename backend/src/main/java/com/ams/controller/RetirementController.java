package com.ams.controller;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.ams.dto.RetirementApplyDTO;
import com.ams.entity.RetirementApplication;
import com.ams.service.RetirementApplicationService;
import com.ams.utils.JwtUtil;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/retirement")
@RequiredArgsConstructor
public class RetirementController {

    private final RetirementApplicationService retirementApplicationService;
    private final JwtUtil jwtUtil;

    @PostMapping("/apply")
    public Result<RetirementApplication> submitApplication(@RequestBody RetirementApplyDTO dto,
                                                            HttpServletRequest request) {
        return Result.success(retirementApplicationService.submitApplication(dto, getCurrentUserId(request)));
    }

    @PostMapping("/applications")
    public Result<RetirementApplication> createApplication(@RequestBody RetirementApplyDTO dto,
                                                            HttpServletRequest request) {
        return submitApplication(dto, request);
    }

    @PostMapping({"/draft", "/applications/draft"})
    public Result<RetirementApplication> createDraftApplication(@RequestBody RetirementApplyDTO dto,
                                                                HttpServletRequest request) {
        return Result.success(retirementApplicationService.createDraftApplication(dto, getCurrentUserId(request)));
    }

    @PostMapping({"/{id}/submit", "/applications/{id}/submit"})
    public Result<RetirementApplication> submitExistingApplication(@PathVariable Long id, HttpServletRequest request) {
        return Result.success(retirementApplicationService.submitExistingApplication(id, getCurrentUserId(request)));
    }

    @GetMapping("/my-applications")
    public Result<Page<RetirementApplication>> getMyApplications(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize,
            HttpServletRequest request) {
        return Result.success(retirementApplicationService.getMyApplications(getCurrentUserId(request), page, pageSize));
    }

    @GetMapping("/applications")
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
    public Result<List<RetirementApplication>> getPendingApplications() {
        return Result.success(retirementApplicationService.queryApplications(1, 100, "PENDING", null).getRecords());
    }

    @GetMapping("/{id}")
    public Result<RetirementApplication> getApplicationById(@PathVariable Long id) {
        return Result.success(retirementApplicationService.getApplicationById(id));
    }

    @GetMapping("/applications/{id}")
    public Result<RetirementApplication> getApplicationAlias(@PathVariable Long id) {
        return getApplicationById(id);
    }

    @PutMapping("/{id}")
    public Result<RetirementApplication> updateApplication(@PathVariable Long id, @RequestBody RetirementApplyDTO dto) {
        return Result.success(retirementApplicationService.updateApplication(id, dto));
    }

    @PutMapping("/applications/{id}")
    public Result<RetirementApplication> updateApplicationAlias(@PathVariable Long id, @RequestBody RetirementApplyDTO dto) {
        return updateApplication(id, dto);
    }

    @DeleteMapping("/{id}")
    public Result<Void> cancelApplication(@PathVariable Long id, HttpServletRequest request) {
        retirementApplicationService.cancelApplication(id, getCurrentUserId(request));
        return Result.success();
    }

    @PostMapping({"/{id}/cancel", "/applications/{id}/cancel"})
    public Result<RetirementApplication> cancelApplicationAlias(@PathVariable Long id, HttpServletRequest request) {
        retirementApplicationService.cancelApplication(id, getCurrentUserId(request));
        return Result.success(retirementApplicationService.getApplicationById(id));
    }

    @PostMapping({"/{id}/approve", "/applications/{id}/approve"})
    public Result<RetirementApplication> approveApplication(@PathVariable Long id, HttpServletRequest request) {
        return Result.success(retirementApplicationService.approveApplication(id, getCurrentUserId(request)));
    }

    @PostMapping({"/{id}/complete", "/applications/{id}/complete"})
    public Result<RetirementApplication> completeApplication(@PathVariable Long id, HttpServletRequest request) {
        return Result.success(retirementApplicationService.completeApplication(id, getCurrentUserId(request)));
    }

    @PostMapping({"/{id}/reject", "/applications/{id}/reject"})
    public Result<RetirementApplication> rejectApplication(@PathVariable Long id,
                                                           @RequestBody(required = false) Map<String, Object> body,
                                                           HttpServletRequest request) {
        return Result.success(retirementApplicationService.rejectApplication(
                id,
                getCurrentUserId(request),
                extractText(body, "reason", "comment", "opinion")));
    }

    @PostMapping("/approve")
    public Result<RetirementApplication> approveApplicationByBody(@RequestBody Map<String, Object> body,
                                                                   HttpServletRequest request) {
        return approveApplication(extractId(body), request);
    }

    @PostMapping("/complete")
    public Result<RetirementApplication> completeApplicationByBody(@RequestBody Map<String, Object> body,
                                                                   HttpServletRequest request) {
        return completeApplication(extractId(body), request);
    }

    @PostMapping("/reject")
    public Result<RetirementApplication> rejectApplicationByBody(@RequestBody Map<String, Object> body,
                                                                 HttpServletRequest request) {
        return rejectApplication(extractId(body), body, request);
    }

    @GetMapping("/asset/{assetId}")
    public Result<List<RetirementApplication>> getAssetRetirementHistory(@PathVariable Long assetId) {
        return Result.success(retirementApplicationService.getAssetRetirementHistory(assetId));
    }

    @GetMapping("/list")
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

    @GetMapping("/{id}/approval-history")
    public Result<List<Map<String, Object>>> getApprovalHistory(@PathVariable Long id) {
        return Result.success(retirementApplicationService.getApprovalHistory(id));
    }

    @GetMapping("/assets/{assetId}/state-history")
    public Result<Map<String, Object>> getAssetStateHistory(@PathVariable Long assetId) {
        return Result.success(retirementApplicationService.getAssetStateHistory(assetId));
    }

    @GetMapping("/statistics")
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

    private Long extractId(Map<String, Object> body) {
        if (body == null) {
            throw new BusinessException("退役申请ID不能为空");
        }
        for (String key : List.of("id", "applicationId", "application_id", "retirementId", "retirement_id", "task_id")) {
            Object value = body.get(key);
            if (value instanceof Number number) {
                return number.longValue();
            }
            if (value instanceof String text && !text.isBlank()) {
                try {
                    return Long.parseLong(text);
                } catch (NumberFormatException ignored) {
                    // Try the next supported id key.
                }
            }
        }
        throw new BusinessException("退役申请ID不能为空");
    }

    private String extractText(Map<String, Object> body, String... keys) {
        if (body == null) {
            return null;
        }
        for (String key : keys) {
            Object value = body.get(key);
            if (value instanceof String text && !text.isBlank()) {
                return text;
            }
        }
        return null;
    }
}
