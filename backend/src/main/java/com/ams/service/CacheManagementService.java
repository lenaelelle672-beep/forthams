package com.ams.service;

import com.ams.config.CacheManagementConfig;
import com.ams.dto.CacheNamespaceStatus;
import com.ams.dto.CacheRefreshResult;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.concurrent.ConcurrentMapCache;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class CacheManagementService {

    private static final String STATUS_CLEARED = "CLEARED";
    private static final String STATUS_CLEARED_EMPTY = "CLEARED_EMPTY";
    private static final String STATUS_NOT_FOUND = "NOT_FOUND";
    private static final String STATUS_UNSUPPORTED = "UNSUPPORTED";
    private static final String STATUS_FAILED = "FAILED";
    private static final String OBSERVABLE_REASON = "ConcurrentMapCache 可观测";

    private static final Map<String, String> NAMESPACE_LABELS = new LinkedHashMap<>();

    static {
        NAMESPACE_LABELS.put(CacheManagementConfig.WORKBENCH_V3_MENU_METADATA, "Workbench V3 菜单元数据");
        NAMESPACE_LABELS.put(CacheManagementConfig.SYSTEM_RUNTIME_DIAGNOSTICS, "系统运行诊断");
    }

    private final CacheManager cacheManager;
    private final ConcurrentMap<String, LocalDateTime> lastRefreshTimes = new ConcurrentHashMap<>();

    public CacheManagementService(@Qualifier(CacheManagementConfig.CACHE_MANAGER_BEAN_NAME) CacheManager cacheManager) {
        this.cacheManager = cacheManager;
    }

    public List<CacheNamespaceStatus> listNamespaces() {
        return NAMESPACE_LABELS.keySet().stream()
                .map(this::toStatus)
                .toList();
    }

    public CacheRefreshResult refreshNamespace(String namespace) {
        if (!NAMESPACE_LABELS.containsKey(namespace)) {
            return result(namespace, STATUS_NOT_FOUND, false, 0, "缓存命名空间不在白名单内", null);
        }
        Cache cache = cacheManager.getCache(namespace);
        if (cache == null) {
            return result(namespace, STATUS_NOT_FOUND, false, 0, "缓存命名空间未注册", null);
        }
        if (!(cache instanceof ConcurrentMapCache concurrentMapCache)) {
            return result(namespace, STATUS_UNSUPPORTED, false, 0, "缓存命名空间当前不可观测，未执行刷新", null);
        }
        try {
            int clearedEntries = entryCount(concurrentMapCache);
            cache.clear();
            LocalDateTime refreshedAt = LocalDateTime.now();
            lastRefreshTimes.put(namespace, refreshedAt);
            if (clearedEntries == 0) {
                return result(namespace, STATUS_CLEARED_EMPTY, false, 0,
                        displayName(namespace) + "为空缓存，未报告普通成功", refreshedAt);
            }
            return result(namespace, STATUS_CLEARED, true, clearedEntries,
                    "已刷新 " + displayName(namespace) + "，清理条目 " + clearedEntries + " 个", refreshedAt);
        } catch (RuntimeException ex) {
            return result(namespace, STATUS_FAILED, false, 0, "缓存刷新失败，敏感细节已脱敏", LocalDateTime.now());
        }
    }

    public List<CacheRefreshResult> refreshAll() {
        return NAMESPACE_LABELS.keySet().stream()
                .map(this::refreshNamespace)
                .toList();
    }

    private CacheNamespaceStatus toStatus(String namespace) {
        CacheNamespaceStatus status = new CacheNamespaceStatus();
        status.setNamespace(namespace);
        status.setDisplayName(displayName(namespace));
        Cache cache = cacheManager.getCache(namespace);
        if (cache instanceof ConcurrentMapCache concurrentMapCache) {
            int count = entryCount(concurrentMapCache);
            status.setObservable(true);
            status.setReason(OBSERVABLE_REASON);
            status.setEntryCount(count);
            status.setEmpty(count == 0);
        } else if (cache == null) {
            status.setObservable(false);
            status.setReason("命名空间未注册，无法观测");
            status.setEntryCount(0);
            status.setEmpty(true);
        } else {
            status.setObservable(false);
            status.setReason("缓存实现不是 ConcurrentMapCache，无法观测条目数");
            status.setEntryCount(0);
            status.setEmpty(false);
        }
        status.setLastRefreshTime(lastRefreshTimes.get(namespace));
        return status;
    }

    private String displayName(String namespace) {
        return NAMESPACE_LABELS.getOrDefault(namespace, namespace);
    }

    private int entryCount(ConcurrentMapCache cache) {
        Object nativeCache = cache.getNativeCache();
        if (nativeCache instanceof Map<?, ?> map) {
            return map.size();
        }
        return 0;
    }

    private CacheRefreshResult result(String namespace, String status, boolean success, int clearedEntries,
                                      String message, LocalDateTime refreshedAt) {
        CacheRefreshResult result = new CacheRefreshResult();
        result.setNamespace(namespace);
        result.setStatus(status);
        result.setSuccess(success);
        result.setClearedEntries(clearedEntries);
        result.setMessage(message);
        result.setRefreshedAt(refreshedAt);
        return result;
    }
}
