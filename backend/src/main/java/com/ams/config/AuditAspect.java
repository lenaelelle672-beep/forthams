package com.ams.config;

import com.ams.common.Auditable;
import com.ams.entity.GeneralAuditEntry;
import com.ams.service.AuditService;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Aspect
@Component
@Slf4j
public class AuditAspect {

    @Autowired
    private AuditService auditService;

    @AfterReturning(pointcut = "@annotation(auditable)", returning = "result")
    public void logAfterReturning(JoinPoint joinPoint, Auditable auditable, Object result) {
        String methodName = joinPoint.getSignature().getName();
        String className = joinPoint.getTarget().getClass().getSimpleName();

        // Create a trace ID (for simplicity, using method name and timestamp)
        String traceId = className + "." + methodName + "-" + System.currentTimeMillis();

        // Convert before and after records to string (this is a simple example, you might want to use JSON serialization)
        String beforeRecord = "Before Record"; // This should be the state of the object before the method execution
        String afterRecord = result.toString(); // This should be the state of the object after the method execution

        GeneralAuditEntry auditEntry = new GeneralAuditEntry();
        auditEntry.setTraceId(traceId);
        auditEntry.setAction(methodName);
        auditEntry.setBeforeRecord(beforeRecord);
        auditEntry.setAfterRecord(afterRecord);

        auditService.save(auditEntry);
    }
}
