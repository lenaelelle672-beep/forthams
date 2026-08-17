package com.ams.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Data
public class FlowDesignerGraphDTO {
    private String id;
    private String name;
    private String description;
    private List<NodeDTO> nodes;
    private List<EdgeDTO> edges;
    @JsonIgnore
    private final Map<String, Object> additionalProperties = new LinkedHashMap<>();

    @JsonAnySetter
    public void addAdditionalProperty(String name, Object value) {
        additionalProperties.put(name, value);
    }

    @Data
    public static class NodeDTO {
        private String id;
        private String type;
        private String label;
        private Map<String, Object> config;
        @JsonIgnore
        private final Map<String, Object> additionalProperties = new LinkedHashMap<>();

        @JsonAnySetter
        public void addAdditionalProperty(String name, Object value) {
            additionalProperties.put(name, value);
        }
    }

    @Data
    public static class EdgeDTO {
        private String id;
        private String source;
        private String target;
        private String label;
        private String sourceHandle;
        private String targetHandle;
        private String conditionExpression;
        private Object condition;
        @JsonIgnore
        private final Map<String, Object> additionalProperties = new LinkedHashMap<>();

        @JsonAnySetter
        public void addAdditionalProperty(String name, Object value) {
            additionalProperties.put(name, value);
        }
    }
}
