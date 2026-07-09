package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomFieldsetPreviewRequestDTO {
    private Long fieldsetId;
    private List<Long> fieldIds;
    private Long categoryId;
}
