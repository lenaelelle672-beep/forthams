package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CacheRefreshResult {
    private String namespace;
    private String status;
    private boolean success;
    private String message;
    private int clearedEntries;
    private LocalDateTime refreshedAt;
}
