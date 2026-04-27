package com.ams.annotation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Annotation to mark methods that should be audited.
 * When a method is annotated with @Audited, the AuditAspect will intercept
 * the method execution and record audit information to GeneralAuditEntry.
 *
 * <p>Usage example:</p>
 * <pre>
 * {@code
 * @Audited(action = "CREATE_ASSET", resource = "Asset", includeArgs = true, includeReturn = true)
 * public Asset createAsset(AssetCreateDTO dto) {
 *     // method implementation
 * }
 * }
 * </pre>
 *
 * @author AMS Development Team
 * @since 1.0.0
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface Audited {

    /**
     * The action being performed (e.g., "CREATE_ASSET", "UPDATE_USER", "DELETE_ROLE").
     * This value is required and will be stored in the audit entry.
     *
     * @return the action name
     */
    String action();

    /**
     * The resource type being acted upon (e.g., "Asset", "User", "Role").
     * This value helps categorize and filter audit entries.
     *
     * @return the resource name
     */
    String resource();

    /**
     * Whether to include method arguments in the audit entry.
     * When set to true, method parameters will be serialized and stored.
     *
     * @return true to include arguments, false otherwise
     */
    boolean includeArgs() default true;

    /**
     * Whether to include the return value in the audit entry.
     * When set to true, the method's return value will be serialized and stored.
     *
     * @return true to include return value, false otherwise
     */
    boolean includeReturn() default true;

    /**
     * The audit level for this method.
     * Different levels may be used for different granularity of auditing.
     *
     * @return the audit level
     */
    AuditLevel level() default AuditLevel.NORMAL;

    /**
     * Optional description providing additional context about the audited operation.
     * This is useful for human-readable audit logs.
     *
     * @return the description of the operation
     */
    String description() default "";

    /**
     * Whether to capture the user ID from the security context.
     * When true, the current authenticated user's ID will be recorded.
     *
     * @return true to capture user ID, false otherwise
     */
    boolean captureUserId() default true;

    /**
     * Whether to record the timestamp of the operation.
     * When true, the exact time of method execution will be stored.
     *
     * @return true to record timestamp, false otherwise
     */
    boolean recordTimestamp() default true;
}