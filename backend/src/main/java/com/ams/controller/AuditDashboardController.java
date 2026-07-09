package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.AuditDashboardQueryDTO;
import com.ams.dto.AuditDistResp;
import com.ams.dto.AuditLogDTO;
import com.ams.dto.AuditLogDetailDTO;
import com.ams.dto.AuditLogStatsDTO;
import com.ams.dto.AuditTrendResp;
import com.ams.dto.OperatorRankingVO;
import com.ams.service.AuditDashboardService;
import com.ams.utils.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/audit-logs")
@RequiredArgsConstructor
public class AuditDashboardController {

    private static final String PERMISSION_QUERY = "system:audit-log:query";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";
    private static final String DENIED_MESSAGE = "缺少审计日志查询权限";

    private final AuditDashboardService auditDashboardService;
    private final JwtUtil jwtUtil;

    @GetMapping
    public Result<AuditLogDTO.PageResult> list(@ModelAttribute AuditDashboardQueryDTO query, HttpServletRequest request) {
        requireQueryPermission(request);
        return Result.success(auditDashboardService.list(query));
    }

    @GetMapping("/{id}")
    public Result<AuditLogDetailDTO> detail(@PathVariable Long id, HttpServletRequest request) {
        requireQueryPermission(request);
        return Result.success(auditDashboardService.detail(id));
    }

    @GetMapping("/stats")
    public Result<AuditLogStatsDTO> stats(@ModelAttribute AuditDashboardQueryDTO query, HttpServletRequest request) {
        requireQueryPermission(request);
        return Result.success(auditDashboardService.stats(query));
    }

    @GetMapping("/trends")
    public Result<AuditTrendResp> trends(@ModelAttribute AuditDashboardQueryDTO query, HttpServletRequest request) {
        requireQueryPermission(request);
        return Result.success(auditDashboardService.trends(query));
    }

    @GetMapping("/action-type-distribution")
    public Result<AuditDistResp> actionTypeDistribution(@ModelAttribute AuditDashboardQueryDTO query, HttpServletRequest request) {
        requireQueryPermission(request);
        return Result.success(auditDashboardService.actionTypeDistribution(query));
    }

    @GetMapping("/operator-ranking")
    public Result<List<OperatorRankingVO>> operatorRanking(@ModelAttribute AuditDashboardQueryDTO query, HttpServletRequest request) {
        requireQueryPermission(request);
        return Result.success(auditDashboardService.operatorRanking(query));
    }

    @GetMapping("/meta")
    public Result<Map<String, Object>> meta(HttpServletRequest request) {
        requireQueryPermission(request);
        return Result.success(auditDashboardService.meta());
    }

    private Long requireQueryPermission(HttpServletRequest request) {
        Long userId = requireCurrentUserId(request);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken || !authentication.isAuthenticated()) {
            throw new AccessDeniedException(DENIED_MESSAGE);
        }
        if (authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority -> PERMISSION_QUERY.equals(authority) || ROLE_SUPER_ADMIN.equals(authority))) {
            return userId;
        }
        throw new AccessDeniedException(DENIED_MESSAGE);
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AccessDeniedException(DENIED_MESSAGE);
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new AccessDeniedException(DENIED_MESSAGE);
        }
        return userId;
    }
}
