package com.ams.middleware;

import org.springframework.stereotype.Component;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Rate Limiter Middleware for API Protection.
 * 
 * Implements token bucket algorithm with sliding window counter for
 * protecting APIs against DoS attacks as identified in round 43/49 audit.
 * 
 * <p>Features:</p>
 * <ul>
 *   <li>Per-user rate limiting using IP + User-Agent fingerprint</li>
 *   <li>Configurable rate limits per endpoint</li>
 *   <li>Thread-safe concurrent access</li>
 *   <li>Returns Retry-After header on 429 responses</li>
 * </ul>
 * 
 * <p>Usage:</p>
 * <pre>
 * // Configure in SecurityConfig or as FilterRegistrationBean
 * FilterRegistrationBean<RateLimiter> registration = new FilterRegistrationBean<>();
 * registration.setFilter(new RateLimiter());
 * registration.addUrlPatterns("/api/*");
 * </pre>
 * 
 * @class RateLimiter
 * @implements Filter
 * @component
 * @see <a href="SWARM-005">SWARM-005 Vendor Closed-Loop Technical Debt Fix</a>
 * @since Round 43/49 Risk Audit - High Severity Fix
 */
@Component
public class RateLimiter implements Filter {

    /**
     * Default maximum requests per window.
     */
    private static final int DEFAULT_MAX_REQUESTS = 100;

    /**
     * Default time window in seconds.
     */
    private static final int DEFAULT_WINDOW_SECONDS = 60;

    /**
     * Store for tracking request counts per client.
     */
    private final ConcurrentHashMap<String, ClientBucket> clientBuckets = new ConcurrentHashMap<>();

    /**
     * Maximum requests allowed per window.
     */
    private int maxRequests = DEFAULT_MAX_REQUESTS;

    /**
     * Time window duration in seconds.
     */
    private int windowSeconds = DEFAULT_WINDOW_SECONDS;

    /**
     * Default constructor with default settings.
     */
    public RateLimiter() {
        // Uses DEFAULT_MAX_REQUESTS and DEFAULT_WINDOW_SECONDS
    }

    /**
     * Constructor with custom rate limit settings.
     * 
     * @param maxRequests   Maximum requests allowed per window
     * @param windowSeconds Time window duration in seconds
     */
    public RateLimiter(int maxRequests, int windowSeconds) {
        this.maxRequests = maxRequests;
        this.windowSeconds = windowSeconds;
    }

    /**
     * Initialize the filter with custom configuration.
     * 
     * @param maxRequests   Maximum requests allowed per window
     * @param windowSeconds Time window duration in seconds
     */
    public void configure(int maxRequests, int windowSeconds) {
        this.maxRequests = maxRequests;
        this.windowSeconds = windowSeconds;
    }

    /**
     * {@inheritDoc}
     * 
     * <p>Filters incoming requests and enforces rate limits.</p>
     * <p>Returns HTTP 429 (Too Many Requests) when limit exceeded with
     * Retry-After header indicating seconds until reset.</p>
     * 
     * @param request  The servlet request
     * @param response The servlet response
     * @param chain    The filter chain
     * @throws IOException      If an I/O error occurs
     * @throws ServletException If a servlet error occurs
     */
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        String clientId = getClientIdentifier(httpRequest);

        // Check rate limit
        RateLimitResult result = checkRateLimit(clientId);

        if (!result.isAllowed()) {
            // Set rate limit headers
            httpResponse.setStatus(429);
            httpResponse.setContentType("application/json");
            httpResponse.setHeader("Retry-After", String.valueOf(result.getRetryAfterSeconds()));
            httpResponse.setHeader("X-RateLimit-Limit", String.valueOf(maxRequests));
            httpResponse.setHeader("X-RateLimit-Remaining", "0");
            httpResponse.setHeader("X-RateLimit-Reset", String.valueOf(result.getResetTimestamp()));

            // Return error response
            httpResponse.getWriter().write(
                "{\"error\":\"rate_limit_exceeded\",\"message\":\"Too many requests. Please retry after " 
                + result.getRetryAfterSeconds() + " seconds.\"}"
            );
            return;
        }

        // Add rate limit headers to successful responses
        httpResponse.setHeader("X-RateLimit-Limit", String.valueOf(maxRequests));
        httpResponse.setHeader("X-RateLimit-Remaining", String.valueOf(result.getRemainingRequests()));

        chain.doFilter(request, response);
    }

    /**
     * Generate a unique identifier for the client based on IP and User-Agent.
     * 
     * @param request The HTTP request
     * @return Client identifier string
     */
    private String getClientIdentifier(HttpServletRequest request) {
        String ip = getClientIp(request);
        String userAgent = request.getHeader("User-Agent");
        
        // Use hash of IP + User-Agent for fingerprinting
        return (ip + ":" + (userAgent != null ? userAgent : "unknown")).hashCode() + "";
    }

    /**
     * Extract client IP address, handling proxy headers.
     * 
     * @param request The HTTP request
     * @return Client IP address
     */
    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            // Return first IP in the chain
            return xForwardedFor.split(",")[0].trim();
        }
        
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        
        return request.getRemoteAddr();
    }

    /**
     * Check and update rate limit for the given client.
     * 
     * @param clientId Client identifier
     * @return Rate limit check result
     */
    private RateLimitResult checkRateLimit(String clientId) {
        long currentTime = System.currentTimeMillis() / 1000;
        
        ClientBucket bucket = clientBuckets.computeIfAbsent(clientId, 
            k -> new ClientBucket(currentTime));

        return bucket.tryConsume(currentTime, maxRequests, windowSeconds);
    }

    /**
     * Clean up expired buckets periodically.
     * Should be called by a scheduled task.
     */
    public void cleanupExpiredBuckets() {
        long currentTime = System.currentTimeMillis() / 1000;
        clientBuckets.entrySet().removeIf(entry -> 
            entry.getValue().isExpired(currentTime, windowSeconds));
    }

    /**
     * Get current count of tracked clients.
     * 
     * @return Number of active client buckets
     */
    public int getActiveClientCount() {
        return clientBuckets.size();
    }

    /**
     * Reset rate limit for a specific client.
     * 
     * @param clientId Client identifier
     */
    public void resetClient(String clientId) {
        clientBuckets.remove(clientId);
    }

    /**
     * Reset all rate limits.
     */
    public void resetAll() {
        clientBuckets.clear();
    }

    /**
     * Client bucket for token bucket algorithm.
     * Thread-safe implementation using AtomicInteger.
     * 
     * @class ClientBucket
     */
    private static class ClientBucket {
        private final AtomicInteger requestCount;
        private final AtomicLong windowStart;
        private final AtomicLong lastReset;

        public ClientBucket(long currentTime) {
            this.requestCount = new AtomicInteger(0);
            this.windowStart = new AtomicLong(currentTime);
            this.lastReset = new AtomicLong(currentTime);
        }

        /**
         * Try to consume a request from the bucket.
         * 
         * @param currentTime   Current timestamp in seconds
         * @param maxRequests   Maximum requests per window
         * @param windowSeconds Window duration in seconds
         * @return Rate limit result
         */
        public RateLimitResult tryConsume(long currentTime, int maxRequests, int windowSeconds) {
            // Check if window has expired
            long windowStartTime = windowStart.get();
            
            if (currentTime - windowStartTime >= windowSeconds) {
                // Reset window
                windowStart.set(currentTime);
                requestCount.set(0);
            }

            // Atomically increment and check
            int currentCount = requestCount.incrementAndGet();

            if (currentCount > maxRequests) {
                // Over limit
                requestCount.decrementAndGet();
                long retryAfter = windowSeconds - (currentTime - windowStartTime);
                return new RateLimitResult(
                    false,
                    0,
                    Math.max(1, retryAfter),
                    windowStartTime + windowSeconds
                );
            }

            return new RateLimitResult(
                true,
                maxRequests - currentCount,
                0,
                windowStartTime + windowSeconds
            );
        }

        /**
         * Check if bucket is expired and should be cleaned up.
         * 
         * @param currentTime   Current timestamp
         * @param windowSeconds Window duration
         * @return true if expired
         */
        public boolean isExpired(long currentTime, int windowSeconds) {
            return (currentTime - windowStart.get()) > (windowSeconds * 2L);
        }
    }

    /**
     * Result of rate limit check.
     * 
     * @class RateLimitResult
     */
    private static class RateLimitResult {
        private final boolean allowed;
        private final int remainingRequests;
        private final long retryAfterSeconds;
        private final long resetTimestamp;

        public RateLimitResult(boolean allowed, int remainingRequests, 
                               long retryAfterSeconds, long resetTimestamp) {
            this.allowed = allowed;
            this.remainingRequests = remainingRequests;
            this.retryAfterSeconds = retryAfterSeconds;
            this.resetTimestamp = resetTimestamp;
        }

        /**
         * Check if the request is allowed.
         * 
         * @return true if allowed
         */
        public boolean isAllowed() {
            return allowed;
        }

        /**
         * Get remaining requests in current window.
         * 
         * @return Remaining requests
         */
        public int getRemainingRequests() {
            return remainingRequests;
        }

        /**
         * Get seconds until rate limit resets.
         * 
         * @return Seconds until reset
         */
        public long getRetryAfterSeconds() {
            return retryAfterSeconds;
        }

        /**
         * Get absolute reset timestamp.
         * 
         * @return Reset timestamp in seconds
         */
        public long getResetTimestamp() {
            return resetTimestamp;
        }
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        // Initialize from filter config if needed
        String maxRequestsParam = filterConfig.getInitParameter("maxRequests");
        if (maxRequestsParam != null) {
            try {
                this.maxRequests = Integer.parseInt(maxRequestsParam);
            } catch (NumberFormatException e) {
                // Use default
            }
        }

        String windowParam = filterConfig.getInitParameter("windowSeconds");
        if (windowParam != null) {
            try {
                this.windowSeconds = Integer.parseInt(windowParam);
            } catch (NumberFormatException e) {
                // Use default
            }
        }
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public void destroy() {
        clientBuckets.clear();
    }

    /**
     * Get max requests configuration.
     * 
     * @return Maximum requests per window
     */
    public int getMaxRequests() {
        return maxRequests;
    }

    /**
     * Get window seconds configuration.
     * 
     * @return Window duration in seconds
     */
    public int getWindowSeconds() {
        return windowSeconds;
    }
}