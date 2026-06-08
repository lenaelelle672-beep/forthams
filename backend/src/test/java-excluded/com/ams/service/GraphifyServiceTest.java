package com.ams.service;

import com.ams.dto.AuditChange;
import com.ams.entity.GraphifyNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class GraphifyServiceTest {

    private GraphifyService graphifyService;

    @BeforeEach
    void setUp() {
        graphifyService = new GraphifyService();
    }

    private List<AuditChange> sampleAuditChanges() {
        return Arrays.asList(
            new AuditChange("status", "IDLE", "ACTIVE", "user-001", "2025-01-01T10:00:00Z"),
            new AuditChange("location", "Warehouse-A", "Office-B101", "user-001", "2025-01-01T10:01:00Z"),
            new AuditChange("value", "5000", "6000", "user-002", "2025-01-01T10:02:00Z")
        );
    }

    @Test
    @DisplayName("ATB-5.1: findGraphifyNodes returns valid structure")
    void testFindGraphifyNodesReturnsValidStructure() {
        List<AuditChange> changes = sampleAuditChanges();
        String assetId = "AST-2024-001";

        List<GraphifyNode> nodes = graphifyService.findGraphifyNodes(changes, assetId);

        assertNotNull(nodes, "Should return a non-null list");
        assertFalse(nodes.isEmpty(), "Should return at least one node");
        assertTrue(nodes.size() >= 1, "Should contain at least the asset node");

        GraphifyNode assetNode = nodes.stream()
            .filter(n -> "asset".equals(n.getType()))
            .findFirst()
            .orElse(null);
        assertNotNull(assetNode, "Should contain an asset node");
        assertEquals(assetId, assetNode.getEntityId());
    }

    @Test
    @DisplayName("ATB-5.2: Empty changes list returns asset node only")
    void testEmptyChangesReturnsAssetNode() {
        List<GraphifyNode> nodes = graphifyService.findGraphifyNodes(Collections.emptyList(), "AST-001");

        assertNotNull(nodes);
        assertEquals(1, nodes.size(), "Should return exactly the asset node");
        assertEquals("asset", nodes.get(0).getType());
        assertEquals("AST-001", nodes.get(0).getEntityId());
    }

    @Test
    @DisplayName("ATB-5.2: Null changes list returns asset node only")
    void testNullChangesReturnsAssetNode() {
        List<GraphifyNode> nodes = graphifyService.findGraphifyNodes(null, "AST-002");

        assertNotNull(nodes);
        assertEquals(1, nodes.size());
        assertEquals("asset", nodes.get(0).getType());
    }

    @Test
    @DisplayName("ATB-5.3: Each AuditChange maps to a field node")
    void testChangeFieldsCorrectlyMapped() {
        List<AuditChange> changes = sampleAuditChanges();
        List<GraphifyNode> nodes = graphifyService.findGraphifyNodes(changes, "AST-003");

        long fieldNodes = nodes.stream()
            .filter(n -> "field".equals(n.getType()))
            .count();
        assertEquals(3, fieldNodes, "Should have 3 field nodes for 3 unique fields");

        GraphifyNode statusNode = nodes.stream()
            .filter(n -> "field".equals(n.getType()) && "status".equals(n.getEntityId()))
            .findFirst()
            .orElse(null);
        assertNotNull(statusNode, "Should have a field node for 'status'");
        assertEquals("IDLE", statusNode.getProperties().get("oldValue"));
        assertEquals("ACTIVE", statusNode.getProperties().get("newValue"));
    }

    @Test
    @DisplayName("Duplicate fields are deduplicated")
    void testDuplicateFieldsDeduplicated() {
        List<AuditChange> changes = Arrays.asList(
            new AuditChange("status", "IDLE", "ACTIVE", "user-001", "2025-01-01T10:00:00Z"),
            new AuditChange("status", "ACTIVE", "MAINTENANCE", "user-002", "2025-01-02T10:00:00Z")
        );

        List<GraphifyNode> nodes = graphifyService.findGraphifyNodes(changes, "AST-004");

        long statusFieldNodes = nodes.stream()
            .filter(n -> "field".equals(n.getType()) && "status".equals(n.getEntityId()))
            .count();
        assertEquals(1, statusFieldNodes, "Duplicate fields should be deduplicated");
    }

    @Test
    @DisplayName("ATB-5.4: validateGraphifyNodes returns true for valid nodes")
    void testValidateValidNodes() {
        List<AuditChange> changes = sampleAuditChanges();
        List<GraphifyNode> nodes = graphifyService.findGraphifyNodes(changes, "AST-005");

        assertTrue(graphifyService.validateGraphifyNodes(nodes),
            "Nodes from findGraphifyNodes should pass validation");
    }

    @Test
    @DisplayName("validateGraphifyNodes returns false for empty list")
    void testValidateEmptyList() {
        assertFalse(graphifyService.validateGraphifyNodes(Collections.emptyList()));
    }

    @Test
    @DisplayName("validateGraphifyNodes returns false for null")
    void testValidateNull() {
        assertFalse(graphifyService.validateGraphifyNodes(null));
    }

    @Test
    @DisplayName("validateGraphifyNodes returns false for nodes without asset")
    void testValidateNoAssetNode() {
        List<GraphifyNode> nodes = Arrays.asList(
            new GraphifyNode("n1", "field", "status", "status", 100, 100, new HashMap<>())
        );
        assertFalse(graphifyService.validateGraphifyNodes(nodes),
            "Should fail when no asset node exists");
    }

    @Test
    @DisplayName("validateGraphifyNodes returns false for node missing id")
    void testValidateNodeMissingId() {
        List<GraphifyNode> nodes = Arrays.asList(
            new GraphifyNode(null, "asset", "AST-001", "Asset", 0, 0, new HashMap<>())
        );
        assertFalse(graphifyService.validateGraphifyNodes(nodes));
    }

    @Test
    @DisplayName("User nodes are created for unique changedBy values")
    void testUserNodesCreated() {
        List<AuditChange> changes = sampleAuditChanges();
        List<GraphifyNode> nodes = graphifyService.findGraphifyNodes(changes, "AST-006");

        long userNodes = nodes.stream()
            .filter(n -> "user".equals(n.getType()))
            .count();
        assertEquals(2, userNodes, "Should have 2 user nodes for user-001 and user-002");
    }
}
