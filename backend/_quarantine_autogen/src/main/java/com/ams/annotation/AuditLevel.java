package com.ams.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Audit level annotation defining the severity/category of audit events.
 * 
 * <p>This annotation is used in conjunction with {@link Audited} to specify
 * the audit level for method interception in the Graphify knowledge graph platform.
 * 
 * <p>Audit levels correspond to the community classification system and align
 * with the AST analysis framework's dead code detection patterns.
 * 
 * <p><b>Usage Example:</b>
 * <pre>
 * {@code @Audited(level = AuditLevel.INFO)}
 * public void processGraphNode(Node node) {
 *     // method implementation
 * }
 * </pre>
 * 
 * <p><b>Level Hierarchy:</b>
 * <ul>
 *   <li>{@link #INFO} - General operational events (community=1)</li>
 *   <li>{@link #WARN} - Warning conditions (community=2)</li>
 *   <li>{@link #ERROR} - Error conditions (community=3)</li>
 *   <li>{@link #CRITICAL} - Critical system events (community=4)</li>
 *   <li>{@link #DEBUG} - Debug/diagnostic events (community=5)</li>
 * </ul>
 * 
 * @see Audited
 * @see Auditable
 * @see com.ams.entity.GeneralAuditEntry
 * @see com.ams.service.AuditService
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface AuditLevel {

    /**
     * Enumeration of supported audit levels.
     * 
     * <p>Each level corresponds to a community classification value
     * for consistency with the AST analysis framework.
     */
    enum Level {
        /** General operational information - community classification 1 */
        INFO(1),
        
        /** Warning level events requiring attention - community classification 2 */
        WARN(2),
        
        /** Error level events indicating failures - community classification 3 */
        ERROR(3),
        
        /** Critical events requiring immediate action - community classification 4 */
        CRITICAL(4),
        
        /** Debug/diagnostic events for troubleshooting - community classification 5 */
        DEBUG(5);

        private final int community;

        Level(int community) {
            this.community = community;
        }

        /**
         * Returns the community classification value.
         * 
         * @return the community number associated with this audit level
         */
        public int getCommunity() {
            return community;
        }
    }

    /**
     * The audit level for the annotated method or class.
     * 
     * <p>Defaults to {@link Level#INFO} for general audit events.
     * 
     * @return the audit level
     */
    Level value() default Level.INFO;

    /**
     * Whether to include method parameters in the audit log.
     * 
     * <p>When true, the audit entry will capture a snapshot of method arguments.
     * Parameter serialization depth is limited to 3 levels to avoid stack overflow.
     * 
     * @return true to capture parameters, false otherwise
     */
    boolean includeParameters() default true;

    /**
     * Whether to include the return value in the audit log.
     * 
     * <p>When true, the audit entry will capture a summary of the method's return value.
     * 
     * @return true to capture return value, false otherwise
     */
    boolean includeReturnValue() default true;

    /**
     * Whether to record execution duration in the audit log.
     * 
     * <p>When true, the audit entry will capture the method execution time in milliseconds.
     * Target constraint: aspect execution should be ≤ 5ms (excluding AuditService write time).
     * 
     * @return true to record duration, false otherwise
     */
    boolean includeDuration() default true;
}