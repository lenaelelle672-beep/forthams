package com.ams.aspect;

import com.ams.entity.GeneralAuditEntry;
import com.ams.service.AuditService;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class AuditAspect {

    @Autowired
    private AuditService auditService;

    @Around("@annotation(auditable)")
    public Object audit(ProceedingJoinPoint joinPoint, Auditable auditable) throws Throwable {
        GeneralAuditEntry auditEntry = new GeneralAuditEntry();
        auditEntry.setTraceId("TRACE_ID"); // Replace with actual trace ID generation logic
        auditEntry.setTimestamp(new Date());
        auditEntry.setAction(auditable.action());

        Object[] args = joinPoint.getArgs();
        String beforeRecord = ""; // Logic to capture the state before operation
        String afterRecord = ""; // Logic to capture the state after operation

        try {
            Object result = joinPoint.proceed(args);
            auditEntry.setAfterRecord(afterRecord);
            return result;
        } finally {
            auditEntry.setBeforeRecord(beforeRecord);
            auditService.save(auditEntry);
        }
    }
}
