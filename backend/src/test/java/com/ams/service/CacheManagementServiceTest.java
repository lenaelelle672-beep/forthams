package com.ams.service;

import com.ams.dto.CacheNamespaceStatus;
import com.ams.dto.CacheRefreshResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cache.Cache;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CacheManagementServiceTest {

    private ConcurrentMapCacheManager cacheManager;
    private CacheManagementService service;

    @BeforeEach
    void setUp() {
        cacheManager = new ConcurrentMapCacheManager("workbench-v3-menu-metadata", "system-runtime-diagnostics");
        service = new CacheManagementService(cacheManager);
    }

    @Test
    void listNamespacesShouldExposeWhitelistAndObservableEmptyState() {
        List<CacheNamespaceStatus> namespaces = service.listNamespaces();

        assertEquals(List.of("workbench-v3-menu-metadata", "system-runtime-diagnostics"),
                namespaces.stream().map(CacheNamespaceStatus::getNamespace).toList());
        CacheNamespaceStatus first = namespaces.get(0);
        assertEquals("Workbench V3 菜单元数据", first.getDisplayName());
        assertTrue(first.isObservable());
        assertTrue(first.isEmpty());
        assertEquals(0, first.getEntryCount());
        assertEquals("ConcurrentMapCache 可观测", first.getReason());
        assertNull(first.getLastRefreshTime());
    }

    @Test
    void refreshNamespaceShouldClearKnownCacheAndRecordLastRefreshTime() {
        Cache cache = cacheManager.getCache("workbench-v3-menu-metadata");
        assertNotNull(cache);
        cache.put("menu", "system-cache-management");

        CacheRefreshResult result = service.refreshNamespace("workbench-v3-menu-metadata");

        assertTrue(result.isSuccess());
        assertEquals("CLEARED", result.getStatus());
        assertEquals(1, result.getClearedEntries());
        assertNotNull(result.getRefreshedAt());
        assertNull(cache.get("menu"));
        assertEquals(result.getRefreshedAt(), service.listNamespaces().get(0).getLastRefreshTime());
    }

    @Test
    void emptyCacheRefreshShouldNotReportOrdinarySuccess() {
        CacheRefreshResult result = service.refreshNamespace("system-runtime-diagnostics");

        assertFalse(result.isSuccess());
        assertEquals("CLEARED_EMPTY", result.getStatus());
        assertEquals(0, result.getClearedEntries());
        assertTrue(result.getMessage().contains("空缓存"));
    }

    @Test
    void unknownNamespaceShouldFailClosed() {
        CacheRefreshResult result = service.refreshNamespace("unknown-cache");

        assertFalse(result.isSuccess());
        assertEquals("NOT_FOUND", result.getStatus());
        assertEquals(0, result.getClearedEntries());
        assertTrue(result.getMessage().contains("不在白名单"));
    }

    @Test
    void refreshAllShouldOnlyVisitWhitelistedNamespaces() {
        Cache cache = cacheManager.getCache("workbench-v3-menu-metadata");
        assertNotNull(cache);
        cache.put("menu", "system-cache-management");

        List<CacheRefreshResult> results = service.refreshAll();

        assertEquals(List.of("workbench-v3-menu-metadata", "system-runtime-diagnostics"),
                results.stream().map(CacheRefreshResult::getNamespace).toList());
        assertEquals("CLEARED", results.get(0).getStatus());
        assertEquals("CLEARED_EMPTY", results.get(1).getStatus());
    }
}
