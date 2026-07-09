package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.LinkedHashMap;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationPreferencePreviewRequestDTO {
    private String category;
    private String channelType;
    private String sampleTime;
    private String quietStart;
    private String quietEnd;

    @Builder.Default
    private Map<String, Object> unknownInputs = new LinkedHashMap<>();

    @JsonAnySetter
    public void putUnknownInput(String name, Object value) {
        if (unknownInputs == null) {
            unknownInputs = new LinkedHashMap<>();
        }
        unknownInputs.put(name, value);
    }
}
