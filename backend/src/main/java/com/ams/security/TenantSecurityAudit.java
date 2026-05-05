package com.ams.security;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

public final class TenantSecurityAudit {

    private TenantSecurityAudit() {
        throw new UnsupportedOperationException("TenantSecurityAudit is a utility class and cannot be instantiated");
    }

    public static void logCrossTenantAttempt(Logger log, String operation, Object resourceId,
                                             String requestTenantId, String resourceTenantId) {
        HttpServletRequest request = currentRequest();
        if (request == null) {
            log.warn("tenant_cross_tenant_attempt operation={} resourceId={} requestTenantId={} resourceTenantId={}",
                    operation, resourceId, requestTenantId, resourceTenantId);
            return;
        }
        log.warn("tenant_cross_tenant_attempt operation={} resourceId={} requestTenantId={} resourceTenantId={} ip={} method={} path={}",
                operation,
                resourceId,
                requestTenantId,
                resourceTenantId,
                request.getRemoteAddr(),
                request.getMethod(),
                request.getRequestURI());
    }

    private static HttpServletRequest currentRequest() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (attributes instanceof ServletRequestAttributes servletRequestAttributes) {
            return servletRequestAttributes.getRequest();
        }
        return null;
    }
}
