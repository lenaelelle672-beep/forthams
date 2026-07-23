package com.ams.utils;

import com.ams.context.TenantContext;
import com.ams.entity.GeneralAuditEntry;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Minimal helper that captures the audit context for a single request and builds a
 * {@link GeneralAuditEntry}.
 *
 * <p>Captures: <b>who</b> (operator id resolved from the JWT, name from the security
 * principal), <b>what</b> (operation/action passed by the caller), <b>when</b>
 * (timestamp), <b>tenant</b> (from {@link TenantContext}), and <b>result</b>
 * (success/failure). The built entry is not persisted here — callers pass it to
 * {@link com.ams.service.AuditService#save(GeneralAuditEntry)}.</p>
 *
 * <p>This intentionally avoids AOP; controllers invoke it directly at the points that
 * matter. All context extraction is defensive: missing values become {@code null} and
 * are handled by the read/dashboard side.</p>
 */
@Component
@RequiredArgsConstructor
public class AuditHelper {

    private final JwtUtil jwtUtil;

    /**
     * Builds a pre-populated audit entry for the current request.
     *
     * @param request        the servlet request (for IP, user-agent, method, URI, operator)
     * @param operationType  coarse operation category, e.g. {@code USER_CREATE}, {@code WORKFLOW_PUBLISH}
     * @param action         fine-grained action label, e.g. {@code create_user}, {@code publish_workflow}
     * @param resourceType   the affected resource type, e.g. {@code USER}, {@code WORKFLOW_DEFINITION}
     * @param resourceId     the affected resource identifier (may be {@code null})
     * @param description    human-readable description (may be {@code null})
     * @param status         {@code SUCCESS} or {@code FAILURE}
     * @return a populated entry ready for {@link com.ams.service.AuditService#save(GeneralAuditEntry)}
     */
    public GeneralAuditEntry buildEntry(HttpServletRequest request,
                                        String operationType,
                                        String action,
                                        String resourceType,
                                        String resourceId,
                                        String description,
                                        String status) {
        GeneralAuditEntry entry = new GeneralAuditEntry();
        entry.setOperationType(operationType);
        entry.setAction(action);
        entry.setResourceType(resourceType);
        entry.setResourceId(resourceId);
        entry.setDescription(description);
        entry.setStatus(status);
        entry.setTimestamp(LocalDateTime.now());
        entry.setCreatedAt(LocalDateTime.now());
        entry.setTenantId(TenantContext.getTenantId());

        if (request != null) {
            entry.setHttpMethod(request.getMethod());
            entry.setRequestUri(request.getRequestURI());
            entry.setIpAddress(resolveClientIp(request));
            entry.setUserAgent(truncate(request.getHeader("User-Agent"), 512));
            Long operatorId = resolveOperatorId(request);
            if (operatorId != null) {
                entry.setOperatorId(operatorId);
            }
            String operatorName = resolveOperatorName();
            if (operatorName != null) {
                entry.setOperatorName(operatorName);
            }
        }
        return entry;
    }

    private Long resolveOperatorId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        try {
            return jwtUtil.getUserIdFromToken(authHeader.substring(7));
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private String resolveOperatorName() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDetails userDetails) {
            return truncate(userDetails.getUsername(), 128);
        }
        if (principal != null) {
            return truncate(principal.toString(), 128);
        }
        return null;
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String first = forwarded.split(",")[0].trim();
            if (!first.isEmpty()) {
                return truncate(first, 64);
            }
        }
        return truncate(request.getRemoteAddr(), 64);
    }

    private String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
