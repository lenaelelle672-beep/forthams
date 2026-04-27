package com.ams.aspect;

import com.ams.annotation.Audited;
import com.ams.entity.GeneralAuditEntry;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * 审计上下文持有者，为切面执行期间提供线程安全的上下文存储。
 * 
 * <p>AuditContext 使用 ThreadLocal 机制确保每个线程拥有独立的审计状态，
 * 避免多线程环境下的数据竞争问题。在 AuditAspect 拦截方法时创建，
 * 方法执行完毕后自动清理。</p>
 * 
 * <p>使用示例：</p>
 * <pre>{@code
 * // 在切面中设置上下文
 * AuditContext context = AuditContext.get();
 * context.setAction("CREATE_ASSET");
 * context.setResourceType("Asset");
 * context.setResourceId(asset.getId());
 * 
 * // 在后续处理中获取上下文
 * AuditContext current = AuditContext.get();
 * String action = current.getAction();
 * }</pre>
 * 
 * @author AMS Team
 * @since 1.0
 */
public final class AuditContext {

    private static final ThreadLocal<AuditContext> CONTEXT_HOLDER = ThreadLocal.withInitial(AuditContext::new);

    private String action;
    private String resourceType;
    private Object resourceId;
    private String userId;
    private String methodName;
    private String className;
    private Object[] arguments;
    private Object result;
    private String errorMessage;
    private Audited auditedAnnotation;
    private Map<String, Object> extraAttributes;
    private LocalDateTime startTime;
    private boolean async;

    /**
     * 私有构造函数，防止外部实例化。
     * 使用 {@link #get()} 和 {@link #clear()} 方法进行上下文管理。
     */
    private AuditContext() {
        this.extraAttributes = new HashMap<>();
        this.startTime = LocalDateTime.now();
    }

    /**
     * 获取当前线程的审计上下文实例。
     * 
     * <p>如果当前线程尚未创建审计上下文，将返回一个新的空上下文。
     * 建议在 {@link AuditAspect} 的切面通知中使用 {@link #init(Audited, String, String)} 初始化。</p>
     * 
     * @return 当前线程的 AuditContext 实例，永不为 null
     */
    public static AuditContext get() {
        return CONTEXT_HOLDER.get();
    }

    /**
     * 初始化审计上下文。
     * 
     * @param annotation   方法上的 @Audited 注解
     * @param methodName   被拦截的方法名
     * @param className    被拦截的类名
     * @return 初始化后的 AuditContext 实例
     */
    public static AuditContext init(Audited annotation, String methodName, String className) {
        AuditContext context = get();
        context.reset();
        context.auditedAnnotation = annotation;
        context.methodName = methodName;
        context.className = className;
        context.startTime = LocalDateTime.now();
        
        if (annotation != null) {
            context.action = annotation.action();
            context.resourceType = annotation.resourceType();
        }
        
        return context;
    }

    /**
     * 重置上下文状态，保留线程以便复用。
     * 
     * <p>此方法不会从 ThreadLocal 中移除上下文，而是将所有字段重置为初始值。
     * 适用于需要重用一个上下文实例的场景。</p>
     */
    public void reset() {
        this.action = null;
        this.resourceType = null;
        this.resourceId = null;
        this.userId = null;
        this.methodName = null;
        this.className = null;
        this.arguments = null;
        this.result = null;
        this.errorMessage = null;
        this.auditedAnnotation = null;
        this.extraAttributes.clear();
        this.startTime = LocalDateTime.now();
        this.async = false;
    }

    /**
     * 清除当前线程的审计上下文。
     * 
     * <p>在方法执行完毕后必须调用此方法，以避免内存泄漏。
     * 建议在 finally 块中调用，确保异常情况下也能正确清理。</p>
     * 
     * <pre>{@code
     * try {
     *     // 审计逻辑
     * } finally {
     *     AuditContext.clear();
     * }
     * }</pre>
     */
    public static void clear() {
        CONTEXT_HOLDER.remove();
    }

    /**
     * 构建审计条目实体。
     * 
     * <p>根据当前上下文的属性创建 {@link GeneralAuditEntry} 实例。
     * 此方法应在方法执行完成后调用，以收集完整的审计信息。</p>
     * 
     * @return 填充了当前上下文数据的 GeneralAuditEntry 实例
     */
    public GeneralAuditEntry toAuditEntry() {
        GeneralAuditEntry entry = new GeneralAuditEntry();
        entry.setAction(this.action);
        entry.setResourceType(this.resourceType);
        entry.setResourceId(this.resourceId != null ? this.resourceId.toString() : null);
        entry.setUserId(this.userId);
        entry.setMethodName(this.methodName);
        entry.setClassName(this.className);
        entry.setStatus(this.errorMessage == null ? "SUCCESS" : "FAILED");
        entry.setErrorMessage(this.errorMessage);
        entry.setStartTime(this.startTime);
        entry.setEndTime(LocalDateTime.now());
        entry.setAsync(this.async);
        
        // 序列化参数和结果
        if (this.arguments != null && this.auditedAnnotation != null && this.auditedAnnotation.includeArgs()) {
            entry.setArguments(serializeArguments());
        }
        
        if (this.result != null && this.auditedAnnotation != null && this.auditedAnnotation.includeReturn()) {
            entry.setReturnValue(serializeResult());
        }
        
        // 添加额外属性
        if (!this.extraAttributes.isEmpty()) {
            entry.setExtraAttributes(this.extraAttributes);
        }
        
        return entry;
    }

    /**
     * 序列化方法参数。
     * 
     * <p>将参数数组转换为 JSON 字符串表示。
     * 子类可以覆盖此方法以实现自定义序列化逻辑。</p>
     * 
     * @return JSON 格式的参数字符串，如果参数为空则返回 null
     */
    protected String serializeArguments() {
        if (arguments == null || arguments.length == 0) {
            return null;
        }
        
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < arguments.length; i++) {
            if (i > 0) {
                sb.append(",");
            }
            Object arg = arguments[i];
            if (arg == null) {
                sb.append("null");
            } else if (arg instanceof String) {
                sb.append("\"").append(escapeString(arg.toString())).append("\"");
            } else {
                sb.append(arg.toString());
            }
        }
        sb.append("]");
        return sb.toString();
    }

    /**
     * 序列化方法返回值。
     * 
     * <p>将返回值对象转换为字符串表示。
     * 子类可以覆盖此方法以实现自定义序列化逻辑。</p>
     * 
     * @return 返回值的字符串表示，如果结果为 null 则返回 null
     */
    protected String serializeResult() {
        if (result == null) {
            return null;
        }
        
        if (result instanceof String) {
            return "\"" + escapeString(result.toString()) + "\"";
        }
        return result.toString();
    }

    /**
     * 转义字符串中的特殊字符。
     * 
     * @param input 输入字符串
     * @return 转义后的字符串
     */
    private String escapeString(String input) {
        if (input == null) {
            return "";
        }
        return input
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t");
    }

    // ========== Getter 方法 ==========

    /**
     * 获取审计动作类型。
     * 
     * @return 动作类型字符串，可能为 null
     */
    public Optional<String> getAction() {
        return Optional.ofNullable(action);
    }

    /**
     * 获取资源类型。
     * 
     * @return 资源类型字符串，可能为 null
     */
    public Optional<String> getResourceType() {
        return Optional.ofNullable(resourceType);
    }

    /**
     * 获取资源标识符。
     * 
     * @return 资源 ID 对象，可能为 null
     */
    public Optional<Object> getResourceId() {
        return Optional.ofNullable(resourceId);
    }

    /**
     * 获取用户 ID。
     * 
     * @return 用户 ID 字符串，可能为 null
     */
    public Optional<String> getUserId() {
        return Optional.ofNullable(userId);
    }

    /**
     * 获取方法名称。
     * 
     * @return 方法名字符串，可能为 null
     */
    public Optional<String> getMethodName() {
        return Optional.ofNullable(methodName);
    }

    /**
     * 获取类名称。
     * 
     * @return 类名字符串，可能为 null
     */
    public Optional<String> getClassName() {
        return Optional.ofNullable(className);
    }

    /**
     * 获取方法参数数组。
     * 
     * @return 参数数组，可能为 null
     */
    public Object[] getArguments() {
        return arguments;
    }

    /**
     * 获取方法返回值。
     * 
     * @return 返回值对象，可能为 null
     */
    public Object getResult() {
        return result;
    }

    /**
     * 获取错误信息。
     * 
     * @return 错误消息字符串，可能为 null
     */
    public Optional<String> getErrorMessage() {
        return Optional.ofNullable(errorMessage);
    }

    /**
     * 获取 @Audited 注解实例。
     * 
     * @return Audited 注解实例，可能为 null
     */
    public Audited getAuditedAnnotation() {
        return auditedAnnotation;
    }

    /**
     * 获取审计开始时间。
     * 
     * @return 开始时间 LocalDateTime
     */
    public LocalDateTime getStartTime() {
        return startTime;
    }

    /**
     * 检查是否为异步审计。
     * 
     * @return 如果是异步审计则返回 true
     */
    public boolean isAsync() {
        return async;
    }

    /**
     * 获取额外属性。
     * 
     * @param key 属性键
     * @return 属性值，如果不存在则返回 null
     */
    public Object getExtraAttribute(String key) {
        return extraAttributes.get(key);
    }

    /**
     * 获取所有额外属性。
     * 
     * @return 不可修改的属性映射
     */
    public Map<String, Object> getExtraAttributes() {
        return new HashMap<>(extraAttributes);
    }

    /**
     * 检查是否存在错误。
     * 
     * @return 如果存在错误消息则返回 true
     */
    public boolean hasError() {
        return errorMessage != null;
    }

    // ========== Setter 方法 ==========

    /**
     * 设置审计动作类型。
     * 
     * @param action 动作类型
     * @return 当前实例，支持链式调用
     */
    public AuditContext action(String action) {
        this.action = action;
        return this;
    }

    /**
     * 设置资源类型。
     * 
     * @param resourceType 资源类型
     * @return 当前实例，支持链式调用
     */
    public AuditContext resourceType(String resourceType) {
        this.resourceType = resourceType;
        return this;
    }

    /**
     * 设置资源标识符。
     * 
     * @param resourceId 资源 ID
     * @return 当前实例，支持链式调用
     */
    public AuditContext resourceId(Object resourceId) {
        this.resourceId = resourceId;
        return this;
    }

    /**
     * 设置用户 ID。
     * 
     * @param userId 用户 ID
     * @return 当前实例，支持链式调用
     */
    public AuditContext userId(String userId) {
        this.userId = userId;
        return this;
    }

    /**
     * 设置方法参数数组。
     * 
     * @param arguments 参数数组
     * @return 当前实例，支持链式调用
     */
    public AuditContext arguments(Object[] arguments) {
        this.arguments = arguments;
        return this;
    }

    /**
     * 设置方法返回值。
     * 
     * @param result 返回值
     * @return 当前实例，支持链式调用
     */
    public AuditContext result(Object result) {
        this.result = result;
        return this;
    }

    /**
     * 设置错误信息。
     * 
     * @param errorMessage 错误消息
     * @return 当前实例，支持链式调用
     */
    public AuditContext errorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
        return this;
    }

    /**
     * 设置异步标志。
     * 
     * @param async 是否异步
     * @return 当前实例，支持链式调用
     */
    public AuditContext async(boolean async) {
        this.async = async;
        return this;
    }

    /**
     * 设置额外属性。
     * 
     * @param key   属性键
     * @param value 属性值
     * @return 当前实例，支持链式调用
     */
    public AuditContext extraAttribute(String key, Object value) {
        this.extraAttributes.put(key, value);
        return this;
    }

    /**
     * 设置多个额外属性。
     * 
     * @param attributes 属性映射
     * @return 当前实例，支持链式调用
     */
    public AuditContext extraAttributes(Map<String, Object> attributes) {
        if (attributes != null) {
            this.extraAttributes.putAll(attributes);
        }
        return this;
    }

    @Override
    public String toString() {
        return "AuditContext{" +
                "action='" + action + '\'' +
                ", resourceType='" + resourceType + '\'' +
                ", resourceId=" + resourceId +
                ", userId='" + userId + '\'' +
                ", methodName='" + methodName + '\'' +
                ", className='" + className + '\'' +
                ", hasError=" + hasError() +
                ", async=" + async +
                '}';
    }
}