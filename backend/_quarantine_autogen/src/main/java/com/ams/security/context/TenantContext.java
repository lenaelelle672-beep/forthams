package com.ams.security.context;

/**
 * 租户上下文持有者
 * 使用 ThreadLocal 存储当前请求的租户 ID，实现线程隔离
 * 
 * @author AMS Security Team
 * @version 1.0.0
 * @since 2024-01-01
 */
public class TenantContext {

    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    /**
     * 获取当前请求的租户 ID
     * 
     * @return 当前租户 ID，如果未设置则返回 null
     */
    public static String getCurrentTenant() {
        return CURRENT_TENANT.get();
    }

    /**
     * 设置当前请求的租户 ID
     * 
     * @param tenantId 租户标识符
     */
    public static void setCurrentTenant(String tenantId) {
        CURRENT_TENANT.set(tenantId);
    }

    /**
     * 清除当前租户上下文
     * 必须在请求结束时调用，防止 ThreadLocal 内存泄漏
     * 
     * @deprecated 使用 {@link #clear()} 代替
     */
    @Deprecated
    public static void remove() {
        clear();
    }

    /**
     * 清除当前租户上下文
     * 在拦截器的 afterCompletion 或 filter 的 finally 块中调用
     */
    public static void clear() {
        CURRENT_TENANT.remove();
    }
}