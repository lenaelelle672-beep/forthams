package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class FormStorageAttachmentDTO {
    private Long id;
    private Long instanceId;
    private String fileName;
    private String contentType;
    private Long fileSize;
    private String referenceKey;
    private String storageKey;
    private String url;
    private String maskedStorageKey;
    private String maskedUrl;
    private String status;
    private String auditSummary;
    private Long operatorId;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
