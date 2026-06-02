package com.ams.datascope;

import com.ams.annotation.DataScope;
import com.ams.security.LoginUser;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class DataScopeAspect {

    private static final Logger log = LoggerFactory.getLogger(DataScopeAspect.class);
    private static final String SUPER_ADMIN = "SUPER_ADMIN";

    @Around("@annotation(dataScope)")
    public Object applyDataScope(ProceedingJoinPoint joinPoint, DataScope dataScope) throws Throwable {
        // SUPER_ADMIN 短路：不设置 DataScopeMeta，完全跳过 DataPermissionInterceptor
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            log.warn("SecurityContext 为空，跳过 SUPER_ADMIN 短路");
        } else if (auth.getPrincipal() instanceof LoginUser loginUser
                && loginUser.getRoles() != null
                && loginUser.getRoles().contains(SUPER_ADMIN)) {
            return joinPoint.proceed();
        }

        DataScopeMeta meta = new DataScopeMeta(dataScope);
        DataScopeContextHolder.set(meta);
        try {
            return joinPoint.proceed();
        } finally {
            DataScopeContextHolder.clear();
        }
    }
}
