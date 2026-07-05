package com.ams.controller;

import com.ams.common.Result;
import com.ams.common.exception.BusinessException;
import com.ams.dto.SystemAlertDTO;
import com.ams.dto.SystemAlertStatusRequest;
import com.ams.service.SystemAlertService;
import com.ams.utils.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping({"/system-alerts", "/system/alerts"})
@RequiredArgsConstructor
public class SystemAlertController {

    private final SystemAlertService systemAlertService;
    private final JwtUtil jwtUtil;

    @GetMapping("/{id}")
    public Result<SystemAlertDTO> getById(@PathVariable Long id) {
        return Result.success(systemAlertService.getById(id));
    }

    @PutMapping("/{id}/status")
    public Result<SystemAlertDTO> updateStatus(
            @PathVariable Long id,
            @RequestBody SystemAlertStatusRequest request,
            HttpServletRequest httpRequest) {
        return Result.success(systemAlertService.updateStatus(id, request, getCurrentUserId(httpRequest)));
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
}
