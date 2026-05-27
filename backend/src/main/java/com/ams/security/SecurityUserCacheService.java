package com.ams.security;

import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;

/**
 * Centralized cache invalidation for cached LoginUser instances.
 */
@Service
public class SecurityUserCacheService {

    @CacheEvict(value = "loginUser", key = "#username")
    public void evictByUsername(String username) {
        // Annotation-driven eviction.
    }

    @CacheEvict(value = "loginUser", allEntries = true)
    public void evictAll() {
        // Annotation-driven eviction.
    }
}
