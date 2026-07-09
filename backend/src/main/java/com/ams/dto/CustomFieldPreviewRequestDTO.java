package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomFieldPreviewRequestDTO {
    private Map<String, Object> values;
    private List<Long> fieldIds;
    private List<String> fieldNames;
}
