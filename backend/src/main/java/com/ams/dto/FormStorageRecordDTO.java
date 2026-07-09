package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class FormStorageRecordDTO {
    private Long id;
    private String formKey;
    private Integer definitionVersion;
    private String businessKey;
    private String status;
    private List<FormStorageFieldValueDTO> fieldSummaries = new ArrayList<>();
    private List<FormStorageAttachmentDTO> attachmentSummaries = new ArrayList<>();
    private String fieldSummary;
    private String attachmentSummary;
    private String auditSummary;
    private Long createdBy;
    private Long updatedBy;
    private Long archivedBy;
    private LocalDateTime archivedAt;
    private String archiveReason;
    private Long deletedBy;
    private LocalDateTime deletedAt;
    private String deleteReason;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
