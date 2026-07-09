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
public class ChannelConfigPreviewRequestDTO {
    private String channelType;
    private String configName;
    private Boolean webhookUrlConfigured;
    private Boolean signatureConfigured;
    private Integer enabled;
    private String sampleEndpoint;

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
