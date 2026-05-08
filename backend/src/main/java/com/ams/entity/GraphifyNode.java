package com.ams.entity;

import lombok.Data;
import java.util.Map;

@Data
public class GraphifyNode {
    private String id;
    private String type;
    private String entityId;
    private String label;
    private double x;
    private double y;
    private Map<String, Object> properties;

    public GraphifyNode() {}

    public GraphifyNode(String id, String type, String entityId, String label,
                        double x, double y, Map<String, Object> properties) {
        this.id = id;
        this.type = type;
        this.entityId = entityId;
        this.label = label;
        this.x = x;
        this.y = y;
        this.properties = properties;
    }
}
