package com.ams.config;

import com.ams.context.TenantContext;
import com.ams.service.impl.UserDetailsServiceImpl;
import com.ams.utils.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
    private static final String AUTHENTICATION_FAILURE_RESPONSE = "认证失败";

    private final JwtUtil jwtUtil;
    private final UserDetailsServiceImpl userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        
        String authHeader = request.getHeader("Authorization");
        
        try {
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                filterChain.doFilter(request, response);
                return;
            }

            // 同一线程上的旧认证绝不能为当前 Bearer token 复用或兜底。
            SecurityContextHolder.clearContext();

            String token = authHeader.substring(7);
            String username;
            Long userId;
            String tenantId;
            Integer tokenVersion;
            try {
                username = jwtUtil.getUsernameFromToken(token);
                userId = jwtUtil.getUserIdFromToken(token);
                tenantId = jwtUtil.getTenantIdFromToken(token);
                tokenVersion = jwtUtil.getTokenVersionFromToken(token);
            } catch (AuthenticationException ex) {
                log.warn("jwt_authentication_failed clientIp={} method={} path={}",
                        request.getRemoteAddr(), request.getMethod(), request.getRequestURI());
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, AUTHENTICATION_FAILURE_RESPONSE);
                return;
            } catch (RuntimeException ex) {
                log.warn("jwt_token_invalid clientIp={} method={} path={}",
                        request.getRemoteAddr(), request.getMethod(), request.getRequestURI());
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, AUTHENTICATION_FAILURE_RESPONSE);
                return;
            }

            if (username == null || username.isBlank() || userId == null || userId <= 0
                    || tokenVersion == null || tokenVersion < 0) {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, AUTHENTICATION_FAILURE_RESPONSE);
                return;
            }

            if (isTenantProtectedRequest(request) && (tenantId == null || tenantId.isBlank())) {
                log.warn("tenant_missing_on_protected_request clientIp={} method={} path={}",
                        request.getRemoteAddr(), request.getMethod(), request.getRequestURI());
                response.sendError(HttpServletResponse.SC_FORBIDDEN, AUTHENTICATION_FAILURE_RESPONSE);
                return;
            }

            if (tenantId != null && !tenantId.isBlank()) {
                TenantContext.setTenantId(tenantId);
            }

            try {
                UserDetails userDetails = userDetailsService.loadUserByUsernameAndTenantId(username, userId, tenantId);
                Integer currentTokenVersion = userDetailsService.getCurrentTokenVersion(username, userId, tenantId);

                if (!jwtUtil.validateToken(token, username, userId, tenantId, tokenVersion)
                        || !tokenVersion.equals(currentTokenVersion)) {
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED, AUTHENTICATION_FAILURE_RESPONSE);
                    return;
                }

                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(
                                userDetails,
                                null,
                                userDetails.getAuthorities()
                        );
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            } catch (AuthenticationException ex) {
                log.warn("jwt_authentication_failed clientIp={} method={} path={}",
                        request.getRemoteAddr(), request.getMethod(), request.getRequestURI());
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, AUTHENTICATION_FAILURE_RESPONSE);
                return;
            } catch (RuntimeException ex) {
                log.warn("jwt_token_invalid clientIp={} method={} path={}",
                        request.getRemoteAddr(), request.getMethod(), request.getRequestURI());
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, AUTHENTICATION_FAILURE_RESPONSE);
                return;
            }

            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
            SecurityContextHolder.clearContext();
        }
    }

    private boolean isTenantProtectedRequest(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return false;
        }

        String uri = request.getRequestURI();
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isBlank() && uri.startsWith(contextPath)) {
            uri = uri.substring(contextPath.length());
        }

        return !(uri.startsWith("/auth/")
                || uri.startsWith("/public/")
                || uri.startsWith("/static/")
                || uri.equals("/error")
                || uri.equals("/favicon.ico"));
    }

}
