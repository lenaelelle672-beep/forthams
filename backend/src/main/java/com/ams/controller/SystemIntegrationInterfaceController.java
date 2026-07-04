package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.SystemIntegrationInterfaceRequest;
import com.ams.dto.SystemIntegrationInterfaceResponse;
import com.ams.dto.SystemInterfaceTestResponse;
import com.ams.service.SystemIntegrationInterfaceService;
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
@RequestMapping("/system/interfaces")
@RequiredArgsConstructor
public class SystemIntegrationInterfaceController {

    private final SystemIntegrationInterfaceService interfaceService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public Result<List<SystemIntegrationInterfaceResponse>> list() {
        return Result.success(interfaceService.list());
    }

    @GetMapping("/{id}")
    public Result<SystemIntegrationInterfaceResponse> get(@PathVariable Long id) {
        return Result.success(interfaceService.get(id));
    }

    @PostMapping
    public Result<SystemIntegrationInterfaceResponse> create(@RequestBody SystemIntegrationInterfaceRequest request,
                                                            HttpServletRequest httpRequest) {
        requireCurrentUserId(httpRequest);
        return Result.success(interfaceService.create(request));
    }

    @PutMapping("/{id}")
    public Result<SystemIntegrationInterfaceResponse> update(@PathVariable Long id,
                                                            @RequestBody SystemIntegrationInterfaceRequest request,
                                                            HttpServletRequest httpRequest) {
        requireCurrentUserId(httpRequest);
        return Result.success(interfaceService.update(id, request));
    }

    @PutMapping("/{id}/status")
    public Result<SystemIntegrationInterfaceResponse> updateStatus(@PathVariable Long id,
                                                                  @RequestParam Boolean enabled,
                                                                  HttpServletRequest httpRequest) {
        requireCurrentUserId(httpRequest);
        return Result.success(interfaceService.updateStatus(id, Boolean.TRUE.equals(enabled)));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id, HttpServletRequest httpRequest) {
        requireCurrentUserId(httpRequest);
        interfaceService.delete(id);
        return Result.success(null);
    }

    @PostMapping("/{id}/test")
    public Result<SystemInterfaceTestResponse> test(@PathVariable Long id, HttpServletRequest httpRequest) {
        requireCurrentUserId(httpRequest);
        return Result.success(interfaceService.testInterface(id));
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
