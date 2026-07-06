package com.ams.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class CacheManagementConfig {

    public static final String CACHE_MANAGER_BEAN_NAME = "cacheManagementCacheManager";
    public static final String WORKBENCH_V3_MENU_METADATA = "workbench-v3-menu-metadata";
    public static final String SYSTEM_RUNTIME_DIAGNOSTICS = "system-runtime-diagnostics";
    public static final List<String> CACHE_NAMESPACES = List.of(WORKBENCH_V3_MENU_METADATA, SYSTEM_RUNTIME_DIAGNOSTICS);

    @Bean(CACHE_MANAGER_BEAN_NAME)
    public CacheManager cacheManagementCacheManager() {
        ConcurrentMapCacheManager cacheManager = new ConcurrentMapCacheManager();
        cacheManager.setCacheNames(CACHE_NAMESPACES);
        cacheManager.setAllowNullValues(false);
        return cacheManager;
    }
}
