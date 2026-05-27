package com.ams.datascope;

import com.ams.annotation.DataScope;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class DataScopeAspect {

    @Around("@annotation(dataScope)")
    public Object applyDataScope(ProceedingJoinPoint joinPoint, DataScope dataScope) throws Throwable {
        DataScopeMeta meta = new DataScopeMeta(dataScope);
        DataScopeContextHolder.set(meta);
        try {
            return joinPoint.proceed();
        } finally {
            DataScopeContextHolder.clear();
        }
    }
}
