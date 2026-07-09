package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MailTemplatePreviewRequestDTO {
    private Long templateId;
    private String templateCode;
    private String subjectTemplate;
    private String contentTemplate;
    private Map<String, Object> variables;
}
