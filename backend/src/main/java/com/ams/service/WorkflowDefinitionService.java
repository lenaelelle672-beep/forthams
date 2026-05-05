package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowStatusUpdateDTO;
import com.ams.entity.WorkflowDefinition;
import com.ams.mapper.WorkflowDefinitionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class WorkflowDefinitionService {

    private static final List<WorkflowTemplate> TEMPLATES = List.of(
            new WorkflowTemplate("ASSET_TRANSFER", "资产转移流程", "用于资产转出、转入确认及双方部门资产管理员审批。"),
            new WorkflowTemplate("ASSET_CLEARANCE", "资产清退流程", "用于闲置资产清退、部门审批、库房确认及 IT 审核。"),
            new WorkflowTemplate("ASSET_SCRAP", "资产报废转让流程", "用于资产报废转让多级审批、收款确认与核算归档。"),
            new WorkflowTemplate("ASSET_COMPENSATION", "资产赔偿流程", "用于资产损失赔偿、信息安全审批、财务审批与库房接收。")
    );

    private final WorkflowDefinitionMapper workflowDefinitionMapper;
    private final ObjectMapper objectMapper;

    public List<WorkflowDefinitionDTO> listDefinitions() {
        String tenantId = TenantContext.requireTenantId();
        return TEMPLATES.stream()
                .map(template -> toDto(findDefinition(tenantId, template.businessType()), template))
                .toList();
    }

    public WorkflowDefinitionDTO getDefinition(String businessType) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowTemplate template = requireTemplate(businessType);
        return toDto(findDefinition(tenantId, template.businessType()), template);
    }

    public WorkflowDefinition requirePublishedDefinition(String businessType) {
        String tenantId = TenantContext.requireTenantId();
        requireTemplate(businessType);
        WorkflowDefinition definition = findDefinition(tenantId, businessType);
        if (definition == null || !"PUBLISHED".equals(definition.getStatus()) || definition.getVersion() == null || definition.getVersion() <= 0) {
            throw new BusinessException("请先发布对应业务流程后再提交审批");
        }
        return definition;
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO saveDraft(String businessType, WorkflowDefinitionSaveDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowTemplate template = requireTemplate(businessType);
        WorkflowDefinition definition = findDefinition(tenantId, businessType);

        if (definition == null) {
            definition = new WorkflowDefinition();
            definition.setTenantId(tenantId);
            definition.setBusinessType(businessType);
            definition.setStatus("DRAFT");
            definition.setVersion(0);
        } else if ("PUBLISHED".equals(definition.getStatus())) {
            definition.setStatus("DRAFT");
        }

        definition.setName(firstPresent(dto.getName(), template.name()));
        definition.setDescription(firstPresent(dto.getDescription(), template.description()));
        definition.setDefinitionJson(toJson(dto.getDefinition() == null ? defaultDefinition(template) : dto.getDefinition()));
        definition.setUpdatedBy(dto.getOperatorId());

        if (definition.getId() == null) {
            workflowDefinitionMapper.insert(definition);
        } else {
            workflowDefinitionMapper.updateById(definition);
        }

        return toDto(definition, template);
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO publish(String businessType, Long operatorId) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowTemplate template = requireTemplate(businessType);
        WorkflowDefinition definition = findDefinition(tenantId, businessType);

        if (definition == null) {
            WorkflowDefinitionSaveDTO dto = new WorkflowDefinitionSaveDTO();
            dto.setName(template.name());
            dto.setDescription(template.description());
            dto.setDefinition(defaultDefinition(template));
            dto.setOperatorId(operatorId);
            saveDraft(businessType, dto);
            definition = findDefinition(tenantId, businessType);
        }

        validateDefinition(definition);
        definition.setStatus("PUBLISHED");
        definition.setVersion((definition.getVersion() == null ? 0 : definition.getVersion()) + 1);
        definition.setPublishedBy(operatorId);
        definition.setPublishedAt(LocalDateTime.now());
        definition.setUpdatedBy(operatorId);
        workflowDefinitionMapper.updateById(definition);
        return toDto(definition, template);
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO updateStatus(String businessType, WorkflowStatusUpdateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowTemplate template = requireTemplate(businessType);
        WorkflowDefinition definition = findDefinition(tenantId, businessType);
        if (definition == null) {
            throw new BusinessException("流程定义不存在");
        }

        String status = dto.getStatus();
        if (!"ENABLED".equals(status) && !"DISABLED".equals(status)) {
            throw new BusinessException("流程状态仅支持 ENABLED 或 DISABLED");
        }
        if ("ENABLED".equals(status) && definition.getVersion() != null && definition.getVersion() > 0) {
            definition.setStatus("PUBLISHED");
        } else if ("ENABLED".equals(status)) {
            throw new BusinessException("流程尚未发布，不能启用");
        } else {
            definition.setStatus("DISABLED");
        }
        definition.setUpdatedBy(dto.getOperatorId());
        workflowDefinitionMapper.updateById(definition);
        return toDto(definition, template);
    }

    private WorkflowDefinition findDefinition(String tenantId, String businessType) {
        return workflowDefinitionMapper.selectOne(new LambdaQueryWrapper<WorkflowDefinition>()
                .eq(WorkflowDefinition::getTenantId, tenantId)
                .eq(WorkflowDefinition::getBusinessType, businessType)
                .last("limit 1"));
    }

    private WorkflowTemplate requireTemplate(String businessType) {
        return TEMPLATES.stream()
                .filter(template -> template.businessType().equals(businessType))
                .findFirst()
                .orElseThrow(() -> new BusinessException("不支持的业务流程类型"));
    }

    private WorkflowDefinitionDTO toDto(WorkflowDefinition definition, WorkflowTemplate template) {
        WorkflowDefinitionDTO dto = new WorkflowDefinitionDTO();
        dto.setBusinessType(template.businessType());
        dto.setName(template.name());
        dto.setDescription(template.description());
        dto.setDefinition(defaultDefinition(template));
        dto.setStatus("UNCONFIGURED");
        dto.setVersion(0);

        if (definition == null) {
            return dto;
        }

        dto.setId(definition.getId());
        dto.setName(definition.getName());
        dto.setDescription(definition.getDescription());
        dto.setDefinition(fromJson(definition.getDefinitionJson(), defaultDefinition(template)));
        dto.setStatus(definition.getStatus());
        dto.setVersion(definition.getVersion());
        dto.setUpdatedBy(definition.getUpdatedBy());
        dto.setPublishedBy(definition.getPublishedBy());
        dto.setPublishedAt(definition.getPublishedAt());
        dto.setCreateTime(definition.getCreateTime());
        dto.setUpdateTime(definition.getUpdateTime());
        return dto;
    }

    private void validateDefinition(WorkflowDefinition definition) {
        Map<String, Object> parsed = fromJson(definition.getDefinitionJson(), Map.of());
        Object nodes = parsed.get("nodes");
        if (!(nodes instanceof List<?> nodeList) || nodeList.isEmpty()) {
            throw new BusinessException("流程定义至少需要一个节点");
        }
    }

    private String toJson(Map<String, Object> definition) {
        try {
            return objectMapper.writeValueAsString(definition);
        } catch (JsonProcessingException ex) {
            throw new BusinessException("流程定义序列化失败");
        }
    }

    private Map<String, Object> fromJson(String json, Map<String, Object> fallback) {
        if (json == null || json.isBlank()) {
            return fallback;
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException ex) {
            return fallback;
        }
    }

    private Map<String, Object> defaultDefinition(WorkflowTemplate template) {
        Map<String, Object> definition = new LinkedHashMap<>();
        definition.put("id", "WF-" + template.businessType());
        definition.put("name", template.name());
        definition.put("description", template.description());
        definition.put("nodes", List.of());
        definition.put("edges", List.of());
        return definition;
    }

    private String firstPresent(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private record WorkflowTemplate(String businessType, String name, String description) {
    }
}
