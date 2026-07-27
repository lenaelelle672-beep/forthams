package com.ams.service;

import com.ams.dto.WorkflowAssigneePreviewDTO;
import com.ams.mapper.UserRoleMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * WorkflowAssigneePreviewService 单元测试。
 *
 * 该服务根据流程定义节点配置（approverType=role/user）解析候选处理人：
 * - role: 通过 UserRoleMapper.selectUserIdsByRoleCode 反查用户 ID 列表
 * - user: 直接采用节点配置的 approverId
 * - START/END: 不需要处理人，标记 resolved=true 并跳过
 * - 未配置处理人: resolved=false，并将字段加入 missingFields
 *
 * 仅当所有节点都解析成功时 calculable=true，否则 calculable=false。
 */
@ExtendWith(MockitoExtension.class)
class WorkflowAssigneePreviewServiceTest {

    @Mock
    private UserRoleMapper userRoleMapper;

    private WorkflowAssigneePreviewService service;

    @BeforeEach
    void setUp() {
        service = new WorkflowAssigneePreviewService(userRoleMapper);
    }

    @Test
    void previewWithEmptyDefinitionShouldBeNotCalculable() {
        WorkflowAssigneePreviewDTO.Request request = new WorkflowAssigneePreviewDTO.Request();
        request.setDefinition(new LinkedHashMap<>(Map.of("nodes", List.of())));

        WorkflowAssigneePreviewDTO.Response response =
                service.preview("asset_transfer", request);

        assertEquals("asset_transfer", response.getBusinessType());
        assertFalse(response.isCalculable());
        assertEquals("流程定义无节点，无法计算处理人", response.getReason());
        assertTrue(response.getNodes().isEmpty());
        verifyNoInteractions(userRoleMapper);
    }

    @Test
    void previewWithNullDefinitionShouldAlsoBeNotCalculable() {
        WorkflowAssigneePreviewDTO.Response response = service.preview("asset_transfer", null);

        assertFalse(response.isCalculable());
        assertEquals("流程定义无节点，无法计算处理人", response.getReason());
        verifyNoInteractions(userRoleMapper);
    }

    @Test
    void previewWithRoleBasedApprovalNodeShouldResolveAssigneesFromMapper() {
        when(userRoleMapper.selectUserIdsByRoleCode("ASSET_MANAGER"))
                .thenReturn(List.of("101", "102"));

        Map<String, Object> approverNode = node("approve-1", "审批", Map.of(
                "approverRole", "ASSET_MANAGER"));

        WorkflowAssigneePreviewDTO.Request request = request(approverNode);

        WorkflowAssigneePreviewDTO.Response response =
                service.preview("asset_transfer", request);

        assertTrue(response.isCalculable());
        assertTrue(response.getMissingFields().isEmpty());

        assertEquals(1, response.getNodes().size());
        WorkflowAssigneePreviewDTO.NodeAssignee assignee = response.getNodes().get(0);
        assertEquals("approve-1", assignee.getNodeId());
        assertEquals("role", assignee.getApproverType());
        assertTrue(assignee.isResolved());
        assertEquals(2, assignee.getAssigneeCount());
        assertEquals("101", assignee.getAssignees().get(0).getUserId());
        assertEquals("102", assignee.getAssignees().get(1).getUserId());

        verify(userRoleMapper).selectUserIdsByRoleCode("ASSET_MANAGER");
    }

    @Test
    void previewWithRoleBasedApprovalNodeHavingNoUsersShouldBeUnresolved() {
        when(userRoleMapper.selectUserIdsByRoleCode("EMPTY_ROLE"))
                .thenReturn(List.of());

        Map<String, Object> approverNode = node("approve-1", "审批", Map.of(
                "approverRole", "EMPTY_ROLE"));

        WorkflowAssigneePreviewDTO.Response response =
                service.preview("asset_transfer", request(approverNode));

        assertFalse(response.isCalculable());
        assertEquals(1, response.getMissingFields().size());
        assertEquals("EMPTY_ROLE", response.getMissingFields().get(0));
        assertFalse(response.getNodes().get(0).isResolved());
        assertTrue(response.getNodes().get(0).getReason().contains("EMPTY_ROLE"));
    }

    @Test
    void previewWithUserBasedApprovalNodeShouldUseApproverIdDirectly() {
        Map<String, Object> approverNode = node("approve-2", "部门审批", Map.of(
                "approverType", "user",
                "approverId", "U200"));

        WorkflowAssigneePreviewDTO.Response response =
                service.preview("asset_transfer", request(approverNode));

        assertTrue(response.isCalculable());

        WorkflowAssigneePreviewDTO.NodeAssignee assignee = response.getNodes().get(0);
        assertEquals("user", assignee.getApproverType());
        assertEquals("U200", assignee.getApproverId());
        assertTrue(assignee.isResolved());
        assertEquals(1, assignee.getAssigneeCount());
        assertEquals("U200", assignee.getAssignees().get(0).getUserId());

        // user 类型不应查询角色映射表
        verifyNoInteractions(userRoleMapper);
    }

    @Test
    void previewWithNoApproverConfiguredShouldBeUnresolvedAndPopulateMissingFields() {
        // approverType 既非 user，也没有 approverRole → 进入"未配置处理人"分支
        Map<String, Object> approverNode = node("approve-3", "审批", Map.of());

        WorkflowAssigneePreviewDTO.Response response =
                service.preview("asset_transfer", request(approverNode));

        assertFalse(response.isCalculable());
        assertEquals(1, response.getMissingFields().size());
        assertEquals("approve-3", response.getMissingFields().get(0));

        WorkflowAssigneePreviewDTO.NodeAssignee assignee = response.getNodes().get(0);
        assertFalse(assignee.isResolved());
        assertEquals("节点未配置处理人", assignee.getReason());
        verifyNoInteractions(userRoleMapper);
    }

    @Test
    void previewWithStartAndEndNodesShouldSkipThemAsResolved() {
        // config.type=START / END → 跳过且 resolved=true，无需处理人
        Map<String, Object> startNode = node("start-1", "开始", new LinkedHashMap<>(Map.of("type", "START")));
        Map<String, Object> endNode = node("end-1", "结束", new LinkedHashMap<>(Map.of("type", "END")));

        WorkflowAssigneePreviewDTO.Response response =
                service.preview("asset_transfer", request(startNode, endNode));

        // 两个节点都是 START/END，全部 resolved → 整体 calculable
        assertTrue(response.isCalculable());
        assertEquals(2, response.getNodes().size());
        for (WorkflowAssigneePreviewDTO.NodeAssignee assignee : response.getNodes()) {
            assertTrue(assignee.isResolved());
            assertEquals(0, assignee.getAssigneeCount());
        }
        verifyNoInteractions(userRoleMapper);
    }

    @Test
    void previewWithStartNodeUsingLowercaseTypeShouldAlsoBeSkipped() {
        // nodeMap.type=start (小写) 也应被识别为 START 节点而跳过
        Map<String, Object> startNode = new LinkedHashMap<>();
        startNode.put("id", "start-1");
        startNode.put("type", "start");

        WorkflowAssigneePreviewDTO.Response response =
                service.preview("asset_transfer", request(startNode));

        assertTrue(response.isCalculable());
        assertTrue(response.getNodes().get(0).isResolved());
        verifyNoInteractions(userRoleMapper);
    }

    @Test
    void previewWithMixedNodesWhereSomeUnresolvedShouldBeNotCalculable() {
        when(userRoleMapper.selectUserIdsByRoleCode("ROLE_A"))
                .thenReturn(List.of("1"));

        Map<String, Object> startNode = node("start-1", "开始", new LinkedHashMap<>(Map.of("type", "START")));
        Map<String, Object> resolvedRoleNode = node("approve-1", "角色审批", Map.of(
                "approverRole", "ROLE_A"));
        // 未配置处理人 → unresolved
        Map<String, Object> unresolvedNode = node("approve-2", "未配置", Map.of());
        Map<String, Object> endNode = node("end-1", "结束", new LinkedHashMap<>(Map.of("type", "END")));

        WorkflowAssigneePreviewDTO.Response response =
                service.preview("asset_transfer", request(startNode, resolvedRoleNode, unresolvedNode, endNode));

        // 至少一个节点 unresolved → 整体不可计算
        assertFalse(response.isCalculable());
        assertEquals("部分节点处理人未解析完成", response.getReason());
        assertEquals(1, response.getMissingFields().size());
        assertEquals("approve-2", response.getMissingFields().get(0));

        assertEquals(4, response.getNodes().size());
        // START/END 节点 resolved
        assertTrue(response.getNodes().get(0).isResolved());
        assertTrue(response.getNodes().get(3).isResolved());
        // 角色节点 resolved
        assertTrue(response.getNodes().get(1).isResolved());
        // 未配置节点 unresolved
        assertFalse(response.getNodes().get(2).isResolved());

        verify(userRoleMapper).selectUserIdsByRoleCode("ROLE_A");
    }

    // ---- helpers ----

    /** 构造一个流程节点：顶层 id/label/nodeCode，配置放在 config 子对象中。 */
    private static Map<String, Object> node(String id, String label, Map<String, Object> config) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("id", id);
        node.put("label", label);
        node.put("nodeCode", id);
        node.put("config", new LinkedHashMap<>(config));
        return node;
    }

    @SafeVarargs
    private static WorkflowAssigneePreviewDTO.Request request(Map<String, Object>... nodes) {
        WorkflowAssigneePreviewDTO.Request request = new WorkflowAssigneePreviewDTO.Request();
        Map<String, Object> definition = new LinkedHashMap<>();
        definition.put("nodes", List.of(nodes));
        request.setDefinition(definition);
        return request;
    }
}
