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
public class NotificationTemplatePreviewRequestDTO {
    private Long templateId;
    private String templateCode;
    private String titleTemplate;
    private String contentTemplate;
    private Map<String, Object> variables;
}
