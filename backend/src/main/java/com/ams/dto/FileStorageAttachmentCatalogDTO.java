package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class FileStorageAttachmentCatalogDTO {

    private List<FileStorageAttachmentMetadataDTO> attachments = new ArrayList<>();
    private FileStorageAttachmentSummaryDTO summary = new FileStorageAttachmentSummaryDTO();
    private FileStorageAttachmentPageDTO page = new FileStorageAttachmentPageDTO();
    private List<String> businessTypes = new ArrayList<>();
    private List<String> fileTypes = new ArrayList<>();
    private List<String> riskTips = new ArrayList<>();
    private String readonlyNotice;

    @Data
    public static class FileStorageAttachmentMetadataDTO {
        private Long id;
        private String businessType;
        private Long businessId;
        private String fileName;
        private String displayName;
        private Long fileSize;
        private String fileType;
        private Long uploadBy;
        private LocalDateTime createTime;
    }

    @Data
    public static class FileStorageAttachmentSummaryDTO {
        private int totalAttachmentCount;
        private long totalFileSize;
        private int businessTypeCount;
        private int fileTypeCount;
        private int currentPageAttachmentCount;
    }

    @Data
    public static class FileStorageAttachmentPageDTO {
        private int page;
        private int pageSize;
        private int totalCount;
        private int totalPages;
    }
}
