package com.ams.dto;

import lombok.Data;
import java.util.List;

@Data
public class CustomFieldValueBatchDTO {

    private List<FieldValueItem> values;

    @Data
    public static class FieldValueItem {
        private Long fieldId;
        private String fieldValue;
    }
}
