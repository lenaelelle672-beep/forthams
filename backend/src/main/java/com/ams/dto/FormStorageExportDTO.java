package com.ams.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Data
public class FormStorageExportDTO {
    private String exportId;
    private LocalDateTime exportedAt;
    private Long operatorId;
    private String auditEvidence;
    private Map<String, Object> querySummary = new LinkedHashMap<>();
    private List<FormStorageRecordDTO> records = new ArrayList<>();
    private List<FormStorageFieldValueDTO> maskedFields = new ArrayList<>();
    private List<FormStorageAttachmentDTO> maskedAttachments = new ArrayList<>();
    private Integer total;
}
