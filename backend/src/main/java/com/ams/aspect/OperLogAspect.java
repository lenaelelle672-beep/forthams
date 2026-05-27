package com.ams.aspect;

import com.ams.annotation.OperLog;
import com.ams.entity.SysOperateLog;
import com.ams.mapper.SysOperateLogMapper;
import com.ams.security.LoginUser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.ArrayList;
import java.util.List;

@Aspect
@Component
@RequiredArgsConstructor
public class OperLogAspect {

    private static final Logger log = LoggerFactory.getLogger(OperLogAspect.class);
    private static final int MAX_TEXT_LENGTH = 4000;

    private final SysOperateLogMapper sysOperateLogMapper;
    private final ObjectMapper objectMapper;

    @Around("@annotation(operLog)")
    public Object around(ProceedingJoinPoint joinPoint, OperLog operLog) throws Throwable {
        long startTime = System.currentTimeMillis();
        Object result = null;
        Throwable error = null;

        try {
            result = joinPoint.proceed();
            return result;
        } catch (Throwable ex) {
            error = ex;
            throw ex;
        } finally {
            saveLog(joinPoint, operLog, result, error, System.currentTimeMillis() - startTime);
        }
    }

    private void saveLog(ProceedingJoinPoint joinPoint, OperLog operLog, Object result, Throwable error, long costTime) {
        try {
            HttpServletRequest request = currentRequest();
            SysOperateLog entry = new SysOperateLog();
            entry.setModule(operLog.title());
            entry.setOperation(operLog.title());
            entry.setBusinessType(operLog.businessType().name());
            entry.setMethod(joinPoint.getSignature().getDeclaringTypeName() + "." + joinPoint.getSignature().getName() + "()");
            entry.setRequestMethod(request != null ? request.getMethod() : null);
            entry.setRequestUri(request != null ? request.getRequestURI() : null);
            entry.setOperatorIp(resolveIp(request));
            entry.setStatus(error == null ? 0 : 1);
            entry.setErrorMessage(error == null ? null : truncate(error.getMessage(), 1000));
            entry.setCostTime(costTime);
            fillOperator(entry);
            fillFallbackOperatorFromArgs(entry, joinPoint.getArgs());

            if (operLog.saveRequestData()) {
                entry.setRequestParams(truncate(toJson(filterArgs(joinPoint.getArgs())), MAX_TEXT_LENGTH));
            }
            if (operLog.saveResponseData()) {
                entry.setResponseData(truncate(toJson(result), MAX_TEXT_LENGTH));
            }

            sysOperateLogMapper.insert(entry);
        } catch (Exception ex) {
            log.warn("save_operate_log_failed message={}", ex.getMessage());
        }
    }

    private HttpServletRequest currentRequest() {
        ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attributes != null ? attributes.getRequest() : null;
    }

    private void fillOperator(SysOperateLog entry) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return;
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof LoginUser loginUser) {
            entry.setOperatorId(loginUser.getUserId());
            entry.setOperatorName(loginUser.getUsername());
            return;
        }

        if (authentication.getName() != null && !"anonymousUser".equals(authentication.getName())) {
            entry.setOperatorName(authentication.getName());
        }
    }

    private void fillFallbackOperatorFromArgs(SysOperateLog entry, Object[] args) {
        if (entry.getOperatorName() != null || args == null) {
            return;
        }
        for (Object arg : args) {
            if (arg == null) {
                continue;
            }
            try {
                Object username = arg.getClass().getMethod("getUsername").invoke(arg);
                if (username instanceof String value && !value.isBlank()) {
                    entry.setOperatorName(value);
                    return;
                }
            } catch (ReflectiveOperationException ignored) {
                // Request DTO has no username getter.
            }
        }
    }

    private String resolveIp(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        return realIp != null && !realIp.isBlank() ? realIp : request.getRemoteAddr();
    }

    private List<Object> filterArgs(Object[] args) {
        List<Object> filtered = new ArrayList<>();
        if (args == null) {
            return filtered;
        }
        for (Object arg : args) {
            if (!shouldSkipArg(arg)) {
                filtered.add(arg);
            }
        }
        return filtered;
    }

    private boolean shouldSkipArg(Object arg) {
        if (arg == null) {
            return false;
        }
        String className = arg.getClass().getName();
        return className.startsWith("jakarta.servlet.")
                || className.startsWith("javax.servlet.")
                || className.startsWith("org.springframework.web.multipart.")
                || className.startsWith("org.springframework.validation.");
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            return String.valueOf(value);
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
