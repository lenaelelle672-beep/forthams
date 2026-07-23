package com.ams.service;

import com.ams.dto.WorkflowAssigneePreviewDTO;
import com.ams.mapper.UserRoleMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 流程处理人预览服务。
 *
 * 解析流程定义中的节点配置，根据 approverType（role/user）解析候选处理人：
 * - role: 通过 roleCode 查 sys_user_role 反查用户 ID 列表
 * - user: 直接使用节点配置的 approverId
 *
 * 用于 /workflows/{businessType}/assignees/preview 端点，
 * 供流程设计器"计算处理人"功能使用。
 */
@Service
@RequiredArgsConstructor
public class WorkflowAssigneePreviewService {

    private final UserRoleMapper userRoleMapper;

    @SuppressWarnings("unchecked")
    public WorkflowAssigneePreviewDTO.Response preview(String businessType, WorkflowAssigneePreviewDTO.Request request) {
        WorkflowAssigneePreviewDTO.Response response = new WorkflowAssigneePreviewDTO.Response();
        response.setBusinessType(businessType);

        Map<String, Object> definition = request != null ? request.getDefinition() : null;
        List<?> nodes = extractNodes(definition);

        if (nodes == null || nodes.isEmpty()) {
            response.setCalculable(false);
            response.setReason("流程定义无节点，无法计算处理人");
            return response;
        }

        boolean allResolved = true;
        List<String> missingFields = new ArrayList<>();
        int stepNo = 0;

        for (Object nodeObj : nodes) {
            stepNo++;
            if (!(nodeObj instanceof Map<?, ?> nodeMap)) continue;

            WorkflowAssigneePreviewDTO.NodeAssignee nodeAssignee = new WorkflowAssigneePreviewDTO.NodeAssignee();
            nodeAssignee.setStepNo(stepNo);
            nodeAssignee.setNodeId(textOf(nodeMap, "id"));
            nodeAssignee.setLabel(textOf(nodeMap, "label"));
            nodeAssignee.setNodeCode(textOf(nodeMap, "nodeCode"));

            Object configObj = nodeMap.get("config");
            Map<?, ?> config = configObj instanceof Map<?, ?> m ? m : nodeMap;

            String type = textOf(config, "type", "approverType");
            String approverType = "user".equalsIgnoreCase(textOf(config, "approverType")) ? "user" : "role";
            String approverRole = textOf(config, "approverRole");
            String approverId = textOf(config, "approverId");

            nodeAssignee.setApproverType(approverType);
            nodeAssignee.setApproverRole(approverRole);
            nodeAssignee.setApproverId(approverId);

            // START/END 节点不需要处理人
            if ("START".equalsIgnoreCase(type) || "END".equalsIgnoreCase(type)
                    || "start".equals(textOf(nodeMap, "type")) || "end".equals(textOf(nodeMap, "type"))) {
                nodeAssignee.setResolved(true);
                response.getNodes().add(nodeAssignee);
                continue;
            }

            List<WorkflowAssigneePreviewDTO.Assignee> assignees = new ArrayList<>();

            if ("user".equals(approverType) && approverId != null && !approverId.isBlank()) {
                assignees.add(new WorkflowAssigneePreviewDTO.Assignee(approverId));
                nodeAssignee.setResolved(true);
            } else if (approverRole != null && !approverRole.isBlank()) {
                List<String> userIds = userRoleMapper.selectUserIdsByRoleCode(approverRole);
                for (String uid : userIds) {
                    assignees.add(new WorkflowAssigneePreviewDTO.Assignee(uid));
                }
                nodeAssignee.setResolved(!assignees.isEmpty());
                if (assignees.isEmpty()) {
                    nodeAssignee.setReason("角色 " + approverRole + " 无关联用户");
                    missingFields.add(approverRole);
                    allResolved = false;
                }
            } else {
                nodeAssignee.setResolved(false);
                nodeAssignee.setReason("节点未配置处理人");
                missingFields.add(nodeAssignee.getNodeId());
                allResolved = false;
            }

            nodeAssignee.setAssigneeCount(assignees.size());
            nodeAssignee.setAssignees(assignees);
            response.getNodes().add(nodeAssignee);
        }

        response.setCalculable(allResolved);
        response.setMissingFields(missingFields);
        if (!allResolved) {
            response.setReason("部分节点处理人未解析完成");
        }
        return response;
    }

    @SuppressWarnings("unchecked")
    private List<?> extractNodes(Map<String, Object> definition) {
        if (definition == null) return null;
        Object nodes = definition.get("nodes");
        if (nodes instanceof List<?> list) return list;
        return null;
    }

    private String textOf(Map<?, ?> map, String... keys) {
        for (String key : keys) {
            Object value = map.get(key);
            if (value != null) return String.valueOf(value);
        }
        return null;
    }
}
