package com.ams.config;

import com.ams.entity.GeneralAuditEntry;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Date;
import java.util.UUID;

@Aspect
@Component
public class AuditAspect {

    private static final Logger log = LoggerFactory.getLogger(AuditAspect.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Around("@annotation(com.ams.annotation.Auditable) || " +
            "@within(com.ams.annotation.Auditable) || " +
            "execution(* com.ams.service..*.*(..))")
    public Object auditMethod(ProceedingJoinPoint joinPoint) throws Throwable {
        String traceId = UUID.randomUUID().toString();
        String action = joinPoint.getSignature().getDeclaringTypeName() + "." + joinPoint.getSignature().getName();

        GeneralAuditEntry entry = new GeneralAuditEntry();
        entry.setTraceId(traceId);
        entry.setTimestamp(new Date());
        entry.setAction(action);

        // Capture before state
        try {
            Object[] args = joinPoint.getArgs();
            entry.setBeforeRecord(args != null && args.length > 0 ? objectMapper.writeValueAsString(args) : "[]");
        } catch (Exception e) {
            entry.setBeforeRecord("[]");
        }

        Object result;
        try {
            result = joinPoint.proceed();
        } catch (Throwable t) {
            try {
                entry.setAfterRecord("ERROR: " + t.getMessage());
            } catch (Exception ignored) {
                entry.setAfterRecord("ERROR");
            }
            log.info("Audit entry: traceId={}, action={}", entry.getTraceId(), entry.getAction());
            throw t;
        }

        // Capture after state
        try {
            entry.setAfterRecord(result != null ? objectMapper.writeValueAsString(result) : "null");
        } catch (Exception e) {
            entry.setAfterRecord("null");
        }

        log.info("Audit entry: traceId={}, action={}", entry.getTraceId(), entry.getAction());
        return result;
    }
}