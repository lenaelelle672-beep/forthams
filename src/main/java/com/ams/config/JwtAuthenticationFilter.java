package com.ams.config;

import com.ams.context.TenantContext;
import com.ams.utils.JwtUtil;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;

/**
 * JWT authentication filter with multi-tenant context management.
 *
 * <p>Extracts {@code tenant_id} from JWT claims and injects it into
 * {@link TenantContext} for downstream Hibernate {@code @Filter}-based data isolation.
 * If the JWT is present but lacks a {@code tenant_id} claim, the request
 * is rejected with HTTP 403 Forbidden per the multi-tenancy SPEC.</p>
 *
 * <p>ThreadLocal lifecycle is guaranteed: {@link TenantContext#clear()} is
 * invoked in a {@code finally} block on every request path (success, exception,
 * or early return) to prevent context leakage across recycled thread-pool threads.</p>
 *
 * <p>Acceptance criteria covered:</p>
 * <ul>
 *   <li>ATB-TC-01: JWT with valid tenant_id → context injected, request proceeds (200)</li>
 *   <li>ATB-TC-02: JWT missing tenant_id → 403 Forbidden</li>
 *   <li>ATB-TC-05: TenantContext.clear() called exactly once per request (finally block)</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    /**
     * Core filter logic: parse JWT, validate mandatory {@code tenant_id} claim,
     * inject tenant context into ThreadLocal, set Spring Security authentication,
     * and delegate to the next filter in the chain.
     *
     * <p>Lifecycle guarantee: {@link TenantContext#clear()} is always invoked in
     * the {@code finally} block regardless of outcome.</p>
     *
     * @param request     the incoming HTTP request
     * @param response    the outgoing HTTP response
     * @param filterChain the filter chain to delegate to
     * @throws ServletException if a servlet-level error occurs downstream
     * @throws IOException      if an I/O error occurs during filter processing
     */
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        try {
            if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);

                // Parse JWT claims using the project's JwtUtil
                Claims claims = jwtUtil.extractAllClaims(token);

                // SPEC requirement: tenant_id is mandatory in JWT claims
                String tenantId = claims.get("tenant_id", String.class);

                if (!StringUtils.hasText(tenantId)) {
                    log.warn("JWT rejected: missing or empty 'tenant_id' claim. URI={}",
                            request.getRequestURI());
                    response.sendError(HttpStatus.FORBIDDEN.value(),
                            "Missing tenant context in token");
                    return;
                }

                // Inject tenant context into ThreadLocal for downstream consumption
                TenantContext.setTenantId(tenantId);
                log.debug("TenantContext bound: tenant_id={}", tenantId);

                // Standard Spring Security authentication establishment
                String username = claims.getSubject();
                if (username != null
                        && SecurityContextHolder.getContext().getAuthentication() == null) {
                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(
                                    username, null, new ArrayList<>());
                    authToken.setDetails(
                            new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }

            filterChain.doFilter(request, response);

        } catch (Exception e) {
            log.error("JWT authentication failed for URI={}: {}",
                    request.getRequestURI(), e.getMessage());
            if (!response.isCommitted()) {
                response.sendError(HttpStatus.UNAUTHORIZED.value(),
                        "Invalid or expired token");
            }
        } finally {
            // MANDATORY per SPEC: absolute cleanup to prevent ThreadLocal leakage
            // across thread-pool recycling, which would cause cross-tenant data exposure.
            TenantContext.clear();
        }
    }

    /**
     * Determine whether this filter should be skipped for the given request.
     * Public endpoints that do not require authentication or tenant context
     * are excluded from filtering.
     *
     * @param request the HTTP request to evaluate
     * @return {@code true} if the filter should be skipped for this request
     */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return path.startsWith("/api/auth")
                || path.equals("/actuator/health")
                || path.startsWith("/swagger-ui")
                || path.startsWith("/v3/api-docs");
    }
}