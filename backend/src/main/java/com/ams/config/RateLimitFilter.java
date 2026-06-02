package com.ams.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

/**
 * 滑动窗口速率限制过滤器。
 * <p>
 * 对 API 请求进行客户端 IP 维度的速率限制：
 * <ul>
 *   <li>/auth/login、/auth/register → 10 次/分钟（防暴力破解）</li>
 *   <li>已认证请求（携带 Bearer Token）→ 120 次/分钟</li>
 *   <li>未认证请求 → 30 次/分钟</li>
 * </ul>
 * 超出限制返回 HTTP 429 及 Retry-After 头。
 * </p>
 */
@Component
@Order(1)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    /** 滑动窗口大小（毫秒） */
    private static final long WINDOW_SIZE_MS = 60_000L;

    /** 登录/注册接口限制（次/窗口） */
    private static final int LIMIT_LOGIN = 10;

    /** 已认证请求限制（次/窗口） */
    private static final int LIMIT_AUTHENTICATED = 600;

    /** 未认证请求限制（次/窗口） */
    private static final int LIMIT_UNAUTHENTICATED = 30;

    /** 客户端 IP → 请求时间戳队列（惰性清理，无需定时线程） */
    private final ConcurrentHashMap<String, Deque<Long>> clientRequests = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        // 使用 servletPath（不含 context-path）判断是否 API 请求
        String path = getPathWithinContext(request);

        // 非 API 路径直接放行
        if (!path.startsWith("/api/") && !path.equals("/api")) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIp(request);
        if (clientIp == null || clientIp.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        // 根据路径和认证状态选择限制级别
        boolean isSensitivePath = path.equals("/api/auth/login") || path.equals("/api/auth/register");
        boolean hasBearerToken = hasBearerToken(request);

        int limit;
        if (isSensitivePath) {
            limit = LIMIT_LOGIN;
        } else if (hasBearerToken) {
            limit = LIMIT_AUTHENTICATED;
        } else {
            limit = LIMIT_UNAUTHENTICATED;
        }

        long now = System.currentTimeMillis();
        long windowStart = now - WINDOW_SIZE_MS;

        // 原子操作：惰性清理 + 阈値检查 + 时间戳添加
        boolean[] exceeded = {false};
        int[] currentSize = {0};

        clientRequests.compute(clientIp, (key, deque) -> {
            if (deque == null) {
                deque = new ConcurrentLinkedDeque<>();
            }
            // 惰性清理：移除窗口外旧时间戳
            while (!deque.isEmpty() && deque.peekFirst() < windowStart) {
                deque.pollFirst();
            }
            currentSize[0] = deque.size();
            if (deque.size() >= limit) {
                exceeded[0] = true;
                return deque; // 不添加，直接返回
            }
            deque.addLast(now);
            currentSize[0] = deque.size(); // 更新为添加后的大小
            return deque;
        });

        if (exceeded[0]) {
            log.warn("rate_limit_exceeded clientIp={} path={} method={} limit={}",
                    clientIp, path, request.getMethod(), limit);
            response.setStatus(429);
            response.setHeader("Retry-After", "60");
            response.setHeader("X-RateLimit-Limit", String.valueOf(limit));
            response.setHeader("X-RateLimit-Remaining", "0");
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"code\":429,\"message\":\"请求过于频繁，请稍后再试\"}");
            return;
        }

        // 正常请求附加剩余量信息
        response.setHeader("X-RateLimit-Limit", String.valueOf(limit));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(Math.max(0, limit - currentSize[0])));

        filterChain.doFilter(request, response);
    }

    /**
     * 获取 context-path 剥离后的请求路径。
     */
    private static String getPathWithinContext(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isBlank() && uri.startsWith(contextPath)) {
            uri = uri.substring(contextPath.length());
        }
        return uri;
    }

    /**
     * 获取客户端真实 IP，优先 X-Forwarded-For。
     */
    private static String getClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    /**
     * 检查请求是否携带 Bearer Token。
     */
    private static boolean hasBearerToken(HttpServletRequest request) {
        String auth = request.getHeader("Authorization");
        return auth != null && auth.startsWith("Bearer ");
    }
}
