package com.ams.service;

import com.ams.common.exception.BusinessException;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 工作流模板注册中心。
 *
 * <p>管理预定义业务类型的工作流模板，提供模板查找、默认定义生成等功能。
 * 所有方法均为无状态的纯函数，不依赖任何外部服务。
 */
@Component
public class WorkflowTemplateRegistry {

    /**
     * 工作流模板，描述一种预定义的业务流程类型。
     *
     * @param businessType    业务类型编码
     * @param name            流程名称
     * @param description     流程说明
     * @param approvalStepCount 默认审批级数
     */
    public record WorkflowTemplate(String businessType, String name, String description, int approvalStepCount) {
    }

    private static final List<WorkflowTemplate> TEMPLATES = List.of(
            new WorkflowTemplate("ASSET_TRANSFER", "资产转移流程", "用于资产转出、转入确认及双方部门资产管理员审批。", 4),
            new WorkflowTemplate("ASSET_CLEARANCE", "资产清退流程", "用于闲置资产清退、部门审批、库房确认及 IT 审核。", 4),
            new WorkflowTemplate("ASSET_SCRAP", "资产报废转让流程", "用于资产报废转让多级审批、收款确认与核算归档。", 4),
            new WorkflowTemplate("ASSET_COMPENSATION", "资产赔偿流程", "用于资产损失赔偿、信息安全审批、财务审批与库房接收。", 4),
            new WorkflowTemplate("RETIREMENT", "资产退役流程", "用于资产退役审批流程。", 4)
    );

    /**
     * 获取所有预定义模板列表。
     */
    public List<WorkflowTemplate> getTemplates() {
        return TEMPLATES;
    }

    /**
     * 根据业务类型查找对应的模板。
     *
     * @param businessType 业务类型编码
     * @return 匹配的模板，未找到时返回 empty
     */
    public Optional<WorkflowTemplate> findTemplate(String businessType) {
        return TEMPLATES.stream()
                .filter(template -> template.businessType().equals(businessType))
                .findFirst();
    }

    /**
     * 根据业务类型查找对应的模板，未找到时抛出异常。
     *
     * @param businessType 业务类型编码
     * @return 匹配的模板
     * @throws BusinessException 未找到匹配模板时抛出
     */
    public WorkflowTemplate requireTemplate(String businessType) {
        return findTemplate(businessType)
                .orElseThrow(() -> new BusinessException("不支持的业务流程类型"));
    }

    /**
     * 判断是否为自定义业务类型（以 "CUSTOM_" 开头）。
     *
     * @param businessType 业务类型编码
     * @return 是否为自定义业务类型
     */
    public boolean isCustomBusinessType(String businessType) {
        return businessType != null && businessType.startsWith("CUSTOM_");
    }

    /**
     * 根据模板生成默认的工作流定义。
     *
     * <p>当 template 为 null 时，返回空壳定义；
     * 否则按照模板的审批级数生成包含开始、审批、结束节点的完整定义。
     *
     * @param template 工作流模板，可以为 null
     * @return 默认的工作流定义 Map
     */
    public Map<String, Object> defaultDefinition(WorkflowTemplate template) {
        if (template == null) {
            Map<String, Object> empty = new LinkedHashMap<>();
            empty.put("id", "WF-default");
            empty.put("name", "默认流程");
            empty.put("description", "");
            empty.put("businessType", "");
            empty.put("nodes", new ArrayList<>());
            empty.put("edges", new ArrayList<>());
            return empty;
        }
        Map<String, Object> definition = new LinkedHashMap<>();
        definition.put("id", "WF-" + template.businessType());
        definition.put("name", template.name());
        definition.put("description", template.description());
        definition.put("businessType", template.businessType());

        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();
        nodes.add(defaultNode("start-1", "start", 320, 40, "提交申请", "业务表单提交后进入审批流程"));

        String previousNodeId = "start-1";
        for (int index = 1; index <= template.approvalStepCount(); index++) {
            String nodeId = "approval-" + index;
            nodes.add(defaultNode(nodeId, "approval", 320, 40 + index * 150,
                    "第" + index + "级审批", "由流程设计器配置的第" + index + "级审批人处理"));
            edges.add(defaultEdge("edge-" + previousNodeId + "-" + nodeId, previousNodeId, nodeId));
            previousNodeId = nodeId;
        }

        nodes.add(defaultNode("end-1", "end", 320, 40 + (template.approvalStepCount() + 1) * 150,
                "流程结束", "审批通过后执行业务落库并归档"));
        edges.add(defaultEdge("edge-" + previousNodeId + "-end-1", previousNodeId, "end-1"));

        definition.put("nodes", nodes);
        definition.put("edges", edges);
        return definition;
    }

    /**
     * 生成自定义流程的默认工作流定义。
     *
     * <p>包含一个开始节点、一个审批节点和一个结束节点。
     *
     * @return 默认的工作流定义 Map
     */
    public Map<String, Object> defaultCustomDefinition() {
        Map<String, Object> definition = new LinkedHashMap<>();
        definition.put("id", "WF-CUSTOM");
        definition.put("name", "自定义流程");
        definition.put("description", "自定义审批流程");
        definition.put("businessType", "CUSTOM");
        List<Map<String, Object>> nodes = new ArrayList<>();
        List<Map<String, Object>> edges = new ArrayList<>();
        nodes.add(defaultNode("start-1", "start", 320, 40, "提交申请", "业务表单提交后进入审批流程"));
        nodes.add(defaultNode("approval-1", "approval", 320, 190, "第1级审批", "由流程设计器配置的第1级审批人处理"));
        nodes.add(defaultNode("end-1", "end", 320, 340, "流程结束", "审批通过后执行业务落库并归档"));
        edges.add(defaultEdge("edge-start-1-approval-1", "start-1", "approval-1"));
        edges.add(defaultEdge("edge-approval-1-end-1", "approval-1", "end-1"));
        definition.put("nodes", nodes);
        definition.put("edges", edges);
        return definition;
    }

    /**
     * 生成默认的节点定义。
     *
     * @param id          节点 ID
     * @param type        节点类型（start / approval / condition / end）
     * @param x           节点 X 坐标
     * @param y           节点 Y 坐标
     * @param label       节点标签
     * @param description 节点说明
     * @return 节点定义 Map
     */
    public Map<String, Object> defaultNode(String id, String type, int x, int y, String label, String description) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("type", type);
        data.put("label", label);
        data.put("description", description);
        data.put("nodeCode", id.toUpperCase().replace('-', '_'));
        data.put("triggerType", "start".equals(type) ? "表单提交" : "");
        data.put("approverType", "approval".equals(type) ? "role" : "");
        data.put("approverRole", "approval".equals(type) ? "SUPER_ADMIN" : "");
        data.put("approverRoleName", "");
        data.put("approverId", "");
        data.put("approvalMode", "sequence");
        data.put("countThreshold", "");
        data.put("conditionExpression", "");
        data.put("trueLabel", "");
        data.put("falseLabel", "");
        data.put("resultAction", "end".equals(type) ? "审批完成并同步业务状态" : "");

        Map<String, Object> position = new LinkedHashMap<>();
        position.put("x", x);
        position.put("y", y);

        Map<String, Object> node = new LinkedHashMap<>();
        node.put("id", id);
        node.put("type", type);
        node.put("position", position);
        node.put("data", data);
        return node;
    }

    /**
     * 生成默认的连线定义。
     *
     * @param id     连线 ID
     * @param source 来源节点 ID
     * @param target 目标节点 ID
     * @return 连线定义 Map
     */
    public Map<String, Object> defaultEdge(String id, String source, String target) {
        Map<String, Object> edge = new LinkedHashMap<>();
        edge.put("id", id);
        edge.put("source", source);
        edge.put("target", target);
        edge.put("sourceHandle", null);
        edge.put("targetHandle", null);
        edge.put("type", "smoothstep");
        edge.put("animated", true);
        edge.put("label", null);
        edge.put("markerEnd", Map.of("type", "arrowclosed", "color", "var(--color-primary)"));
        edge.put("style", Map.of("stroke", "var(--color-primary)", "strokeWidth", 2));
        edge.put("labelStyle", Map.of("fill", "var(--color-foreground)", "fontSize", 12, "fontWeight", 600));
        edge.put("labelBgStyle", Map.of("fill", "var(--workflow-surface)", "fillOpacity", 1));
        return edge;
    }
}
