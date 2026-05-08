package com.ams.service;

import com.ams.dto.AuditChange;
import com.ams.entity.GraphifyNode;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class GraphifyService {

    private static final double FIELD_X_OFFSET = 200.0;
    private static final double FIELD_Y_SPACING = 100.0;
    private static final double ASSET_X = 0.0;
    private static final double ASSET_Y = 0.0;

    public List<GraphifyNode> findGraphifyNodes(List<AuditChange> changes, String assetId) {
        List<GraphifyNode> nodes = new ArrayList<>();

        Map<String, Object> assetProps = new HashMap<>();
        assetProps.put("assetId", assetId);
        nodes.add(new GraphifyNode(
            "node-asset-" + assetId,
            "asset",
            assetId,
            "Asset: " + assetId,
            ASSET_X,
            ASSET_Y,
            assetProps
        ));

        if (changes == null || changes.isEmpty()) {
            return nodes;
        }

        Set<String> seenFields = new HashSet<>();
        int fieldIndex = 0;
        for (AuditChange change : changes) {
            String field = change.getField();
            if (field == null || seenFields.contains(field)) {
                continue;
            }
            seenFields.add(field);

            Map<String, Object> fieldProps = new HashMap<>();
            fieldProps.put("field", field);
            fieldProps.put("oldValue", change.getOldValue());
            fieldProps.put("newValue", change.getNewValue());
            if (change.getChangedBy() != null) {
                fieldProps.put("changedBy", change.getChangedBy());
            }

            nodes.add(new GraphifyNode(
                "node-field-" + field + "-" + assetId,
                "field",
                field,
                field,
                FIELD_X_OFFSET,
                FIELD_Y_SPACING * (fieldIndex + 1),
                fieldProps
            ));
            fieldIndex++;

            if (change.getChangedBy() != null && !change.getChangedBy().isEmpty()) {
                String userId = change.getChangedBy();
                boolean userExists = nodes.stream()
                    .anyMatch(n -> "user".equals(n.getType()) && userId.equals(n.getEntityId()));
                if (!userExists) {
                    Map<String, Object> userProps = new HashMap<>();
                    userProps.put("userId", userId);
                    nodes.add(new GraphifyNode(
                        "node-user-" + userId,
                        "user",
                        userId,
                        "User: " + userId,
                        FIELD_X_OFFSET * 2,
                        FIELD_Y_SPACING * (fieldIndex),
                        userProps
                    ));
                }
            }
        }

        return nodes;
    }

    public boolean validateGraphifyNodes(List<GraphifyNode> nodes) {
        if (nodes == null || nodes.isEmpty()) {
            return false;
        }

        for (GraphifyNode node : nodes) {
            if (node.getId() == null || node.getId().isEmpty()) {
                return false;
            }
            if (node.getType() == null || node.getType().isEmpty()) {
                return false;
            }
            if (node.getEntityId() == null || node.getEntityId().isEmpty()) {
                return false;
            }
            if (node.getLabel() == null) {
                return false;
            }
        }

        boolean hasAsset = nodes.stream().anyMatch(n -> "asset".equals(n.getType()));
        return hasAsset;
    }
}
