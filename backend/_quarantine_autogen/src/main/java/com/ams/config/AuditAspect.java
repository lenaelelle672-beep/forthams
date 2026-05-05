package com.ams.config;

import com.ams.aspect.AuditAspect;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.EnableAspectJAutoProxy;

/**
 * Configuration class that enables AspectJ auto-proxying and registers the
 * custom {@link AuditAspect} to handle audit logging for service operations.
 * <p>
 * This configuration is required for the audit logging functionality to work
 * within the Spring application context. It ensures that aspects are woven
 * correctly for all Spring-managed beans.
 * </p>
 *
 * @see AuditAspect
 * @see EnableAspectJAutoProxy
 */
@Configuration
@EnableAspectJAutoProxy
public class AuditAspect {
    // This class intentionally left blank as it serves as a configuration marker.
    // The actual audit aspect logic is implemented in com.ams.aspect.AuditAspect.
}