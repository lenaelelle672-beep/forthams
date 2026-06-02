package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.WorkflowDefinition;
import com.ams.entity.WorkflowEdge;
import com.ams.entity.WorkflowNode;
import com.ams.mapper.WorkflowDefinitionMapper;
import com.ams.mapper.WorkflowEdgeMapper;
import com.ams.mapper.WorkflowNodeMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class WorkflowDesignerService {

    private final WorkflowNodeMapper workflowNodeMapper;
    private final WorkflowEdgeMapper workflowEdgeMapper;
    private final WorkflowDefinitionMapper workflowDefinitionMapper;

    /**
     * 获取指定流程定义的节点和连线数据
     */
    public Map<String, Object> getDesign(Long definitionId) {
        WorkflowDefinition def = workflowDefinitionMapper.selectById(definitionId);
        if (def == null) {
            throw new BusinessException("流程定义不存在");
        }

        List<WorkflowNode> nodes = workflowNodeMapper.selectList(
                new LambdaQueryWrapper<WorkflowNode>()
                        .eq(WorkflowNode::getDefinitionId, definitionId)
                        .orderByAsc(WorkflowNode::getSortOrder));

        List<WorkflowEdge> edges = workflowEdgeMapper.selectList(
                new LambdaQueryWrapper<WorkflowEdge>()
                        .eq(WorkflowEdge::getDefinitionId, definitionId)
                        .orderByAsc(WorkflowEdge::getSortOrder));

        Map<String, Object> result = new HashMap<>();
        result.put("definition", def);
        result.put("nodes", nodes);
        result.put("edges", edges);
        return result;
    }

    /**
     * 保存流程设计（事务性：先删除旧节点和连线，再批量插入）
     */
    @Transactional(rollbackFor = Exception.class)
    public void saveDesign(Long definitionId, List<WorkflowNode> nodes, List<WorkflowEdge> edges) {
        WorkflowDefinition def = workflowDefinitionMapper.selectById(definitionId);
        if (def == null) {
            throw new BusinessException("流程定义不存在");
        }

        // 删除旧节点和连线
        workflowNodeMapper.delete(new LambdaQueryWrapper<WorkflowNode>()
                .eq(WorkflowNode::getDefinitionId, definitionId));
        workflowEdgeMapper.delete(new LambdaQueryWrapper<WorkflowEdge>()
                .eq(WorkflowEdge::getDefinitionId, definitionId));

        // 批量插入节点
        if (nodes != null) {
            for (int i = 0; i < nodes.size(); i++) {
                WorkflowNode node = nodes.get(i);
                node.setId(null);
                node.setDefinitionId(definitionId);
                if (node.getSortOrder() == null) {
                    node.setSortOrder(i);
                }
                workflowNodeMapper.insert(node);
            }
        }

        // 批量插入连线
        if (edges != null) {
            for (int i = 0; i < edges.size(); i++) {
                WorkflowEdge edge = edges.get(i);
                edge.setId(null);
                edge.setDefinitionId(definitionId);
                if (edge.getSortOrder() == null) {
                    edge.setSortOrder(i);
                }
                workflowEdgeMapper.insert(edge);
            }
        }
    }

    /**
     * 发布流程设计：校验节点合法性，更新定义状态为已发布，自增版本号
     */
    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinition publishDesign(Long definitionId) {
        WorkflowDefinition def = workflowDefinitionMapper.selectById(definitionId);
        if (def == null) {
            throw new BusinessException("流程定义不存在");
        }

        // 获取节点列表进行校验
        List<WorkflowNode> nodes = workflowNodeMapper.selectList(
                new LambdaQueryWrapper<WorkflowNode>()
                        .eq(WorkflowNode::getDefinitionId, definitionId));

        if (nodes == null || nodes.isEmpty()) {
            throw new BusinessException("流程定义至少需要一个节点，请先保存设计");
        }

        // 校验必须包含 START、APPROVAL、END 节点
        boolean hasStart = false, hasApproval = false, hasEnd = false;
        for (WorkflowNode node : nodes) {
            String type = node.getNodeType();
            if ("START".equals(type)) hasStart = true;
            else if ("APPROVAL".equals(type)) hasApproval = true;
            else if ("END".equals(type)) hasEnd = true;
        }

        if (!hasStart) {
            throw new BusinessException("流程必须包含开始节点");
        }
        if (!hasApproval) {
            throw new BusinessException("流程至少需要一个审批节点");
        }
        if (!hasEnd) {
            throw new BusinessException("流程必须包含结束节点");
        }

        // 更新定义状态
        def.setStatus("PUBLISHED");
        def.setVersion((def.getVersion() == null ? 0 : def.getVersion()) + 1);
        def.setPublishedAt(LocalDateTime.now());
        workflowDefinitionMapper.updateById(def);

        return def;
    }

    /**
     * 获取版本历史（这里简化返回 WorkflowDefinition 的版本信息）
     */
    public List<WorkflowDefinition> getVersionHistory(Long definitionId) {
        WorkflowDefinition def = workflowDefinitionMapper.selectById(definitionId);
        if (def == null) {
            throw new BusinessException("流程定义不存在");
        }
        // 按业务类型查找所有版本的历史记录
        return workflowDefinitionMapper.selectList(
                new LambdaQueryWrapper<WorkflowDefinition>()
                        .eq(WorkflowDefinition::getBusinessType, def.getBusinessType())
                        .orderByDesc(WorkflowDefinition::getVersion));
    }
}
