package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.SystemFieldMappingPreviewRequest;
import com.ams.dto.SystemFieldMappingPreviewResponse;
import com.ams.dto.SystemFieldMappingRequest;
import com.ams.dto.SystemFieldMappingResponse;
import com.ams.service.SystemFieldMappingService;
import com.ams.utils.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/system/field-mappings")
@RequiredArgsConstructor
public class SystemFieldMappingController {

    private final SystemFieldMappingService fieldMappingService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public Result<List<SystemFieldMappingResponse>> list() {
        return Result.success(fieldMappingService.list());
    }

    @GetMapping("/{id}")
    public Result<SystemFieldMappingResponse> get(@PathVariable Long id) {
        return Result.success(fieldMappingService.get(id));
    }

    @PostMapping
    public Result<SystemFieldMappingResponse> create(@RequestBody SystemFieldMappingRequest request,
                                                     HttpServletRequest httpRequest) {
        requireCurrentUserId(httpRequest);
        return Result.success(fieldMappingService.create(request));
    }

    @PutMapping("/{id}")
    public Result<SystemFieldMappingResponse> update(@PathVariable Long id,
                                                     @RequestBody SystemFieldMappingRequest request,
                                                     HttpServletRequest httpRequest) {
        requireCurrentUserId(httpRequest);
        return Result.success(fieldMappingService.update(id, request));
    }

    @PutMapping("/{id}/status")
    public Result<SystemFieldMappingResponse> updateStatus(@PathVariable Long id,
                                                           @RequestParam Boolean enabled,
                                                           HttpServletRequest httpRequest) {
        requireCurrentUserId(httpRequest);
        return Result.success(fieldMappingService.updateStatus(id, Boolean.TRUE.equals(enabled)));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id, HttpServletRequest httpRequest) {
        requireCurrentUserId(httpRequest);
        fieldMappingService.delete(id);
        return Result.success(null);
    }

    @PostMapping("/preview")
    public Result<SystemFieldMappingPreviewResponse> preview(@RequestBody SystemFieldMappingPreviewRequest request) {
        return Result.success(fieldMappingService.preview(request));
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AccessDeniedException("缺少系统管理权限");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new AccessDeniedException("缺少系统管理权限");
        }
        return userId;
    }
}
