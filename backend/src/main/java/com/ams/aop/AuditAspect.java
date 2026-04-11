package com.ams.aop;

import com.ams.common.Auditable;
import com.ams.entity.GeneralAuditEntry;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class AuditAspect {

    @AfterReturning(pointcut = "@annotation(auditable)", returning = "result")
    public void audit(JoinPoint joinPoint, Auditable auditable, Object result) {
        // Extract necessary information from the JoinPoint and create a GeneralAuditEntry.
        String action = auditable.action();
        String traceId = "";  // Implement logic to get trace_id
        String beforeRecord = "";  // Implement logic to capture state before operation
        String afterRecord = "";   // Implement logic to capture state after operation

        GeneralAuditEntry auditEntry = new GeneralAuditEntry();
        auditEntry.setTraceId(traceId);
        auditEntry.setAction(action);
        auditEntry.setBeforeRecord(beforeRecord);
        auditEntry.setAfterRecord(afterRecord);

        // Save the audit entry to the database
        // Example: auditService.save(auditEntry);
    }
}
