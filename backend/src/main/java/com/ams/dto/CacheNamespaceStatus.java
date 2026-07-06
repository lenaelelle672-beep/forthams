package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CacheNamespaceStatus {
    private String namespace;
    private String displayName;
    private boolean observable;
    private String reason;
    private int entryCount;
    private boolean empty;
    private LocalDateTime lastRefreshTime;
}
