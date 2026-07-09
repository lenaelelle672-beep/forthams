package com.ams.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class FlowDesignerGraphDTO {
    private String id;
    private String name;
    private String description;
    private List<NodeDTO> nodes;
    private List<EdgeDTO> edges;

    @Data
    public static class NodeDTO {
        private String id;
        private String type;
        private String label;
        private Map<String, Object> config;
    }

    @Data
    public static class EdgeDTO {
        private String id;
        private String source;
        private String target;
        private String label;
    }
}
