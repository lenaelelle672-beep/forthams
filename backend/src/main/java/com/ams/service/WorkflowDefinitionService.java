package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.common.exception.ConflictException;
import com.ams.context.TenantContext;
import com.ams.dto.FlowDesignerDraftDTO;
import com.ams.dto.FlowDesignerGraphDTO;
import com.ams.dto.FlowDesignerOperationDTO;
import com.ams.dto.FlowDesignerValidationResultDTO;
import com.ams.dto.WorkflowDefinitionDTO;
import com.ams.dto.WorkflowDefinitionSaveDTO;
import com.ams.dto.WorkflowDefinitionVersionDTO;
import com.ams.dto.WorkflowDesignerDraftDTO;
import com.ams.dto.WorkflowStatusUpdateDTO;
import com.ams.entity.WorkflowDefinition;
import com.ams.entity.WorkflowDefinitionDraft;
import com.ams.entity.WorkflowDefinitionVersion;
import com.ams.mapper.WorkflowDefinitionDraftMapper;
import com.ams.mapper.WorkflowDefinitionMapper;
import com.ams.mapper.WorkflowDefinitionVersionMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class WorkflowDefinitionService {

    private static final String STATUS_PUBLISHED = "PUBLISHED";
    private static final String STATUS_DISABLED = "DISABLED";

    private static final List<WorkflowTemplate> TEMPLATES = List.of(
            new WorkflowTemplate("ASSET_TRANSFER", "资产转移流程", "用于资产转出、转入确认及双方部门资产管理员审批。"),
            new WorkflowTemplate("ASSET_CLEARANCE", "资产清退流程", "用于闲置资产清退、部门审批、库房确认及 IT 审核。"),
            new WorkflowTemplate("ASSET_SCRAP", "资产报废转让流程", "用于资产报废转让多级审批、收款确认与核算归档。"),
            new WorkflowTemplate("ASSET_COMPENSATION", "资产赔偿流程", "用于资产损失赔偿、信息安全审批、财务审批与库房接收。"),
            new WorkflowTemplate("RETIREMENT", "资产退役流程", "用于资产退役申请及受控审批。"),
            new WorkflowTemplate("WORK_ORDER", "工单审批流程", "用于工单提交后的受控审批。")
    );

    private final WorkflowDefinitionMapper workflowDefinitionMapper;
    private final WorkflowDefinitionDraftMapper workflowDefinitionDraftMapper;
    private final WorkflowDefinitionVersionMapper workflowDefinitionVersionMapper;
    private final ApprovalAssignmentService approvalAssignmentService;
    private final ObjectMapper objectMapper;

    /** 公开定义接口只返回不可变已发布快照，绝不返回草稿。 */
    public List<WorkflowDefinitionDTO> listDefinitions() {
        String tenantId = TenantContext.requireTenantId();
        return TEMPLATES.stream()
                .map(template -> toPublishedDto(findPublishedProjection(tenantId, template.businessType()), template))
                .toList();
    }

    /** 公开定义接口只返回不可变已发布快照，绝不返回草稿。 */
    public WorkflowDefinitionDTO getDefinition(String businessType) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowTemplate template = requireTemplate(businessType);
        return toPublishedDto(findPublishedProjection(tenantId, template.businessType()), template);
    }

    /** 设计器草稿从独立 projection 读取，不能覆盖运行时已发布 projection。 */
    public WorkflowDesignerDraftDTO getDesignerDraft(String businessType) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowTemplate template = requireTemplate(businessType);
        return toDesignerDraftDto(
                findDraft(tenantId, template.businessType()),
                findPublishedProjection(tenantId, template.businessType()),
                template);
    }

    /**
     * 业务提交闸门。历史 projection 声称已发布但没有对应不可变快照时必须拒绝，不能猜测
     * 或用当前 projection 补写历史。
     */
    public WorkflowDefinition requirePublishedDefinition(String businessType) {
        String tenantId = TenantContext.requireTenantId();
        requireTemplate(businessType);
        WorkflowDefinition definition = findPublishedProjection(tenantId, businessType);
        if (definition == null || !STATUS_PUBLISHED.equals(definition.getStatus())
                || definition.getVersion() == null || definition.getVersion() <= 0) {
            throw new BusinessException("请先发布对应业务流程后再提交审批");
        }
        validateSnapshot(requireSnapshot(tenantId, definition));
        return definition;
    }

    /**
     * 兼容旧草稿接口。返回值仅表示草稿，不携带或修改已发布 projection。
     */
    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO saveDraft(String businessType, WorkflowDefinitionSaveDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowTemplate template = requireTemplate(businessType);
        if (dto == null) {
            throw new BusinessException("流程草稿不能为空");
        }
        Long operatorId = requireOperatorId(dto.getOperatorId());
        WorkflowDefinitionDraft draft = findDraft(tenantId, template.businessType());
        if (draft == null) {
            if (dto.getExpectedRevision() != null) {
                throw draftConflict("流程草稿不存在或已被删除，请重新读取草稿后重试");
            }
            draft = new WorkflowDefinitionDraft();
            draft.setTenantId(tenantId);
            draft.setBusinessType(template.businessType());
            draft.setName(firstPresent(dto.getName(), template.name()));
            draft.setDescription(firstPresent(dto.getDescription(), template.description()));
            draft.setDefinitionJson(toJson(dto.getDefinition() == null ? defaultDefinition(template) : dto.getDefinition()));
            draft.setRevision(1);
            draft.setUpdatedBy(operatorId);
            try {
                if (workflowDefinitionDraftMapper.insert(draft) != 1) {
                    throw new BusinessException("流程草稿保存失败");
                }
            } catch (DuplicateKeyException exception) {
                throw draftConflict("流程草稿已由其他编辑者创建，请重新读取草稿后重试");
            }
        } else {
            Integer expectedRevision = requireExpectedDraftRevision(dto.getExpectedRevision(), "保存草稿");
            int currentRevision = requireDraftRevision(draft);
            if (expectedRevision != currentRevision) {
                throw draftConflict("流程草稿已更新（当前 revision=" + currentRevision + "），请刷新后重试");
            }
            int nextRevision = nextDraftRevision(currentRevision);
            String name = firstPresent(dto.getName(), template.name());
            String description = firstPresent(dto.getDescription(), template.description());
            String definitionJson = toJson(dto.getDefinition() == null ? defaultDefinition(template) : dto.getDefinition());
            int updated = workflowDefinitionDraftMapper.updateWithExpectedRevision(
                    draft.getId(), tenantId, template.businessType(), expectedRevision,
                    name, description, definitionJson, operatorId);
            if (updated != 1) {
                throw draftConflict("流程草稿已被其他编辑者更新，请刷新后重试");
            }
            draft.setName(name);
            draft.setDescription(description);
            draft.setDefinitionJson(definitionJson);
            draft.setUpdatedBy(operatorId);
            draft.setRevision(nextRevision);
        }
        return toLegacyDraftDto(draft, template);
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDesignerDraftDTO saveDesignerDraft(String businessType, FlowDesignerDraftDTO dto, Long operatorId) {
        if (dto == null) {
            throw new BusinessException("流程设计器草稿不能为空");
        }
        WorkflowDefinitionSaveDTO saveDTO = new WorkflowDefinitionSaveDTO();
        saveDTO.setName(dto.getName());
        saveDTO.setDescription(dto.getDescription());
        saveDTO.setDefinition(toDefinitionMap(dto.getGraph()));
        saveDTO.setExpectedRevision(dto.getExpectedRevision());
        saveDTO.setOperatorId(requireOperatorId(operatorId));
        saveDraft(businessType, saveDTO);
        return getDesignerDraft(businessType);
    }

    public FlowDesignerValidationResultDTO validateDesignerGraph(FlowDesignerGraphDTO graph) {
        return toValidationResult(LinearWorkflowDefinitionValidator.validate(toDefinitionMap(graph)));
    }

    /**
     * 发布只以独立 draft 为输入；写入新 immutable version 后在同一事务更新当前 published
     * projection。当前 projection 从不作为草稿存储。
     */
    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO publish(String businessType, FlowDesignerOperationDTO operation) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowTemplate template = requireTemplate(businessType);
        Long operatorId = requireOperatorId(operation == null ? null : operation.getOperatorId());
        requireConfirmed(operation, "发布");
        String reason = requireAuditReason(operation, "发布");
        requireAuditEvidence(operation, "发布");

        WorkflowDefinitionDraft draft = requireDraftForUpdate(tenantId, template.businessType());
        Integer expectedDraftRevision = requireExpectedDraftRevision(
                operation == null ? null : operation.getExpectedDraftRevision(), "发布");
        requireMatchingDraftRevision(draft, expectedDraftRevision, "发布");
        validateDefinitionJson(draft.getDefinitionJson());
        approvalAssignmentService.requirePublishableAssignees(draft.getDefinitionJson(), tenantId);
        int consumedDraftRevision = nextDraftRevision(expectedDraftRevision);
        if (workflowDefinitionDraftMapper.consumeRevision(draft.getId(), tenantId, template.businessType(),
                expectedDraftRevision) != 1) {
            throw draftConflict("流程草稿已被其他发布者消费，请重新审阅后重试");
        }
        draft.setRevision(consumedDraftRevision);
        WorkflowDefinition definition = findPublishedProjectionForUpdate(tenantId, template.businessType());
        if (isPublishedProjection(definition)) {
            validateSnapshot(requireSnapshot(tenantId, definition));
        }

        int nextVersion = isPublishedProjection(definition) ? nextVersion(definition) : 1;
        if (definition == null) {
            definition = new WorkflowDefinition();
            definition.setTenantId(tenantId);
            definition.setBusinessType(template.businessType());
        }
        definition.setName(draft.getName());
        definition.setDescription(draft.getDescription());
        definition.setDefinitionJson(draft.getDefinitionJson());
        definition.setStatus(STATUS_PUBLISHED);
        definition.setVersion(nextVersion);
        definition.setPublishedBy(operatorId);
        definition.setPublishedAt(LocalDateTime.now());
        definition.setUpdatedBy(operatorId);

        if (definition.getId() == null) {
            if (workflowDefinitionMapper.insert(definition) != 1 || definition.getId() == null) {
                throw new BusinessException("已发布流程 projection 写入失败");
            }
        } else if (workflowDefinitionMapper.updateById(definition) != 1) {
            throw new BusinessException("已发布流程 projection 写入失败");
        }

        WorkflowDefinitionVersion snapshot = appendVersionSnapshot(
                tenantId, definition, "PUBLISH", reason, operation, null);
        return toPublishedDto(definition, template, snapshot);
    }

    public List<WorkflowDefinitionVersionDTO> listVersions(String businessType) {
        String tenantId = TenantContext.requireTenantId();
        requireTemplate(businessType);
        WorkflowDefinition definition = findPublishedProjection(tenantId, businessType);
        if (definition == null || definition.getId() == null) {
            return List.of();
        }
        return workflowDefinitionVersionMapper.selectList(new LambdaQueryWrapper<WorkflowDefinitionVersion>()
                        .eq(WorkflowDefinitionVersion::getTenantId, tenantId)
                        .eq(WorkflowDefinitionVersion::getDefinitionId, definition.getId())
                        .orderByDesc(WorkflowDefinitionVersion::getVersion)
                        .orderByDesc(WorkflowDefinitionVersion::getId))
                .stream()
                .map(this::toVersionDto)
                .toList();
    }

    public WorkflowDefinitionVersionDTO getVersion(String businessType, Integer version) {
        String tenantId = TenantContext.requireTenantId();
        requireTemplate(businessType);
        WorkflowDefinition definition = requireProjection(tenantId, businessType);
        return toVersionDto(requireVersion(tenantId, definition, version));
    }

    /** 回滚复用历史 snapshot 内容，但仍追加新的不可变版本，绝不覆盖历史行。 */
    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO rollback(String businessType, Integer version, FlowDesignerOperationDTO operation) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowTemplate template = requireTemplate(businessType);
        Long operatorId = requireOperatorId(operation == null ? null : operation.getOperatorId());
        requireConfirmed(operation, "回滚");
        String reason = requireAuditReason(operation, "回滚");
        requireAuditEvidence(operation, "回滚");

        verifyRollbackDraftReview(tenantId, template.businessType(), operation);
        WorkflowDefinition definition = findPublishedProjectionForUpdate(tenantId, template.businessType());
        if (!isPublishedProjection(definition)) {
            throw new BusinessException("流程定义不存在可信的已发布版本");
        }
        Integer expectedPublishedVersion = requireExpectedPublishedVersion(operation);
        if (!expectedPublishedVersion.equals(definition.getVersion())) {
            throw draftConflict("当前已发布版本已变化，请重新审阅后再回滚");
        }
        validateSnapshot(requireSnapshot(tenantId, definition));
        WorkflowDefinitionVersion sourceVersion = requireVersion(tenantId, definition, version);
        validateSnapshot(sourceVersion);
        approvalAssignmentService.requirePublishableAssignees(sourceVersion.getDefinitionJson(), tenantId);
        if (version != null && version.equals(definition.getVersion())) {
            throw new BusinessException("回滚版本与当前版本相同，无需回滚");
        }

        definition.setName(sourceVersion.getName());
        definition.setDescription(sourceVersion.getDescription());
        definition.setDefinitionJson(sourceVersion.getDefinitionJson());
        definition.setStatus(STATUS_PUBLISHED);
        definition.setVersion(nextVersion(definition));
        definition.setPublishedBy(operatorId);
        definition.setPublishedAt(LocalDateTime.now());
        definition.setUpdatedBy(operatorId);
        if (workflowDefinitionMapper.updateById(definition) != 1) {
            throw new BusinessException("已发布流程 projection 写入失败");
        }
        WorkflowDefinitionVersion snapshot = appendVersionSnapshot(
                tenantId, definition, "ROLLBACK", reason, operation, sourceVersion.getVersion());
        return toPublishedDto(definition, template, snapshot);
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkflowDefinitionDTO updateStatus(String businessType, WorkflowStatusUpdateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        WorkflowTemplate template = requireTemplate(businessType);
        if (dto == null) {
            throw new BusinessException("流程状态不能为空");
        }
        WorkflowDefinition definition = requireProjectionForUpdate(tenantId, template.businessType());
        WorkflowDefinitionVersion snapshot = requireSnapshot(tenantId, definition);
        validateSnapshot(snapshot);

        String status = dto.getStatus();
        if (!"ENABLED".equals(status) && !STATUS_DISABLED.equals(status)) {
            throw new BusinessException("流程状态仅支持 ENABLED 或 DISABLED");
        }
        String targetStatus = "ENABLED".equals(status) ? STATUS_PUBLISHED : STATUS_DISABLED;
        Long operatorId = requireOperatorId(dto.getOperatorId());
        int updated = workflowDefinitionMapper.update(null, new LambdaUpdateWrapper<WorkflowDefinition>()
                .set(WorkflowDefinition::getStatus, targetStatus)
                .set(WorkflowDefinition::getUpdatedBy, operatorId)
                .eq(WorkflowDefinition::getId, definition.getId())
                .eq(WorkflowDefinition::getTenantId, tenantId)
                .eq(WorkflowDefinition::getBusinessType, template.businessType())
                .eq(WorkflowDefinition::getVersion, definition.getVersion())
                .eq(WorkflowDefinition::getStatus, definition.getStatus()));
        if (updated != 1) {
            throw new BusinessException("流程状态更新失败");
        }
        definition.setStatus(targetStatus);
        definition.setUpdatedBy(operatorId);
        return toPublishedDto(definition, template, snapshot);
    }

    private WorkflowDefinitionDraft requireDraftForUpdate(String tenantId, String businessType) {
        WorkflowDefinitionDraft draft = findDraftForUpdate(tenantId, businessType);
        if (draft == null) {
            throw new BusinessException("请先保存流程设计器草稿后再发布");
        }
        return draft;
    }

    private WorkflowDefinition requireProjection(String tenantId, String businessType) {
        WorkflowDefinition definition = findPublishedProjection(tenantId, businessType);
        if (definition == null || definition.getId() == null) {
            throw new BusinessException("流程定义不存在");
        }
        return definition;
    }

    private WorkflowDefinition requireProjectionForUpdate(String tenantId, String businessType) {
        WorkflowDefinition definition = findPublishedProjectionForUpdate(tenantId, businessType);
        if (definition == null || definition.getId() == null) {
            throw new BusinessException("流程定义不存在");
        }
        return definition;
    }

    private WorkflowDefinitionDraft findDraft(String tenantId, String businessType) {
        return workflowDefinitionDraftMapper.selectOne(new LambdaQueryWrapper<WorkflowDefinitionDraft>()
                .eq(WorkflowDefinitionDraft::getTenantId, tenantId)
                .eq(WorkflowDefinitionDraft::getBusinessType, businessType)
                .last("limit 1"));
    }

    private WorkflowDefinitionDraft findDraftForUpdate(String tenantId, String businessType) {
        return workflowDefinitionDraftMapper.selectOne(new LambdaQueryWrapper<WorkflowDefinitionDraft>()
                .eq(WorkflowDefinitionDraft::getTenantId, tenantId)
                .eq(WorkflowDefinitionDraft::getBusinessType, businessType)
                .last("FOR UPDATE"));
    }

    private WorkflowDefinition findPublishedProjection(String tenantId, String businessType) {
        return workflowDefinitionMapper.selectOne(new LambdaQueryWrapper<WorkflowDefinition>()
                .eq(WorkflowDefinition::getTenantId, tenantId)
                .eq(WorkflowDefinition::getBusinessType, businessType)
                .last("limit 1"));
    }

    private WorkflowDefinition findPublishedProjectionForUpdate(String tenantId, String businessType) {
        return workflowDefinitionMapper.selectOne(new LambdaQueryWrapper<WorkflowDefinition>()
                .eq(WorkflowDefinition::getTenantId, tenantId)
                .eq(WorkflowDefinition::getBusinessType, businessType)
                .last("FOR UPDATE"));
    }

    private WorkflowDefinitionVersion requireVersion(String tenantId, WorkflowDefinition definition, Integer version) {
        if (version == null || version <= 0 || definition.getId() == null) {
            throw new BusinessException("版本号不合法");
        }
        WorkflowDefinitionVersion snapshot = workflowDefinitionVersionMapper.selectOne(
                new LambdaQueryWrapper<WorkflowDefinitionVersion>()
                        .eq(WorkflowDefinitionVersion::getTenantId, tenantId)
                        .eq(WorkflowDefinitionVersion::getDefinitionId, definition.getId())
                        .eq(WorkflowDefinitionVersion::getVersion, version)
                        .last("limit 1"));
        if (snapshot == null || !definition.getBusinessType().equals(snapshot.getBusinessType())) {
            throw new BusinessException("流程版本不存在或不属于当前定义");
        }
        return snapshot;
    }

    private WorkflowDefinitionVersion requireSnapshot(String tenantId, WorkflowDefinition definition) {
        if (definition == null || definition.getId() == null || definition.getVersion() == null
                || definition.getVersion() <= 0) {
            throw new BusinessException("已发布流程版本快照缺失，拒绝运行");
        }
        WorkflowDefinitionVersion snapshot = workflowDefinitionVersionMapper.selectOne(
                new LambdaQueryWrapper<WorkflowDefinitionVersion>()
                        .eq(WorkflowDefinitionVersion::getTenantId, tenantId)
                        .eq(WorkflowDefinitionVersion::getDefinitionId, definition.getId())
                        .eq(WorkflowDefinitionVersion::getVersion, definition.getVersion())
                        .last("limit 1"));
        if (snapshot == null || !definition.getBusinessType().equals(snapshot.getBusinessType())
                || !STATUS_PUBLISHED.equals(snapshot.getStatus())) {
            throw new BusinessException("已发布流程版本快照缺失，拒绝运行");
        }
        return snapshot;
    }

    private WorkflowDefinitionVersion appendVersionSnapshot(String tenantId,
                                                            WorkflowDefinition definition,
                                                            String actionType,
                                                            String reason,
                                                            FlowDesignerOperationDTO operation,
                                                            Integer rollbackSourceVersion) {
        WorkflowDefinitionVersion snapshot = new WorkflowDefinitionVersion();
        snapshot.setTenantId(tenantId);
        snapshot.setDefinitionId(definition.getId());
        snapshot.setBusinessType(definition.getBusinessType());
        snapshot.setVersion(definition.getVersion());
        snapshot.setActionType(actionType);
        snapshot.setStatus(STATUS_PUBLISHED);
        snapshot.setName(definition.getName());
        snapshot.setDescription(definition.getDescription());
        snapshot.setDefinitionJson(definition.getDefinitionJson());
        snapshot.setPublishNote(firstPresent(operation == null ? null : operation.getPublishNote(), reason));
        snapshot.setImpactScope(operation == null ? null : operation.getImpactScope());
        snapshot.setRollbackPlan(operation == null ? null : operation.getRollbackPlan());
        snapshot.setRollbackSourceVersion(rollbackSourceVersion);
        snapshot.setOperatorId(definition.getPublishedBy());
        snapshot.setPublishedAt(definition.getPublishedAt());
        if (workflowDefinitionVersionMapper.insert(snapshot) != 1) {
            throw new BusinessException("流程版本快照写入失败");
        }
        return snapshot;
    }

    private int nextVersion(WorkflowDefinition definition) {
        int current = definition == null || definition.getVersion() == null ? 0 : definition.getVersion();
        if (current < 0) {
            throw new BusinessException("当前流程版本不合法");
        }
        try {
            return Math.incrementExact(current);
        } catch (ArithmeticException exception) {
            throw new BusinessException("流程版本号已达到上限");
        }
    }

    private WorkflowDefinitionDTO toPublishedDto(WorkflowDefinition definition, WorkflowTemplate template) {
        WorkflowDefinitionDTO dto = defaultPublishedDto(template);
        if (definition == null || !isPublishedProjection(definition)) {
            return dto;
        }
        return toPublishedDto(definition, template, requireSnapshot(TenantContext.requireTenantId(), definition));
    }

    private WorkflowDefinitionDTO toPublishedDto(WorkflowDefinition definition,
                                                 WorkflowTemplate template,
                                                 WorkflowDefinitionVersion snapshot) {
        validateSnapshot(snapshot);
        WorkflowDefinitionDTO dto = defaultPublishedDto(template);
        dto.setId(definition.getId());
        dto.setBusinessType(template.businessType());
        dto.setName(snapshot.getName());
        dto.setDescription(snapshot.getDescription());
        dto.setDefinition(parseDefinition(snapshot.getDefinitionJson(), "已发布流程版本快照无法解析，拒绝运行"));
        dto.setStatus(definition.getStatus());
        dto.setVersion(definition.getVersion());
        dto.setDraftRevision(null);
        dto.setUpdatedBy(definition.getUpdatedBy());
        dto.setPublishedBy(definition.getPublishedBy());
        dto.setPublishedAt(definition.getPublishedAt());
        dto.setCreateTime(definition.getCreateTime());
        dto.setUpdateTime(definition.getUpdateTime());
        return dto;
    }

    private WorkflowDefinitionDTO defaultPublishedDto(WorkflowTemplate template) {
        WorkflowDefinitionDTO dto = new WorkflowDefinitionDTO();
        dto.setBusinessType(template.businessType());
        dto.setName(template.name());
        dto.setDescription(template.description());
        dto.setDefinition(defaultDefinition(template));
        dto.setStatus("UNCONFIGURED");
        dto.setVersion(0);
        return dto;
    }

    private WorkflowDefinitionDTO toLegacyDraftDto(WorkflowDefinitionDraft draft, WorkflowTemplate template) {
        WorkflowDefinitionDTO dto = new WorkflowDefinitionDTO();
        dto.setId(draft.getId());
        dto.setBusinessType(template.businessType());
        dto.setName(draft.getName());
        dto.setDescription(draft.getDescription());
        dto.setDefinition(parseDefinition(draft.getDefinitionJson(), "流程草稿无法解析"));
        dto.setStatus("DRAFT");
        dto.setVersion(draft.getRevision() == null ? 0 : draft.getRevision());
        dto.setDraftRevision(draft.getRevision());
        dto.setUpdatedBy(draft.getUpdatedBy());
        dto.setCreateTime(draft.getCreateTime());
        dto.setUpdateTime(draft.getUpdateTime());
        return dto;
    }

    private WorkflowDesignerDraftDTO toDesignerDraftDto(WorkflowDefinitionDraft draft,
                                                         WorkflowDefinition projection,
                                                         WorkflowTemplate template) {
        WorkflowDesignerDraftDTO dto = new WorkflowDesignerDraftDTO();
        dto.setBusinessType(template.businessType());
        dto.setName(template.name());
        dto.setDescription(template.description());
        dto.setDefinition(defaultDefinition(template));
        dto.setStatus("UNCONFIGURED");
        dto.setVersion(0);
        dto.setRevision(null);
        if (isPublishedProjection(projection)) {
            WorkflowDefinitionVersion snapshot = requireSnapshot(TenantContext.requireTenantId(), projection);
            dto.setId(projection.getId());
            dto.setName(snapshot.getName());
            dto.setDescription(snapshot.getDescription());
            dto.setDefinition(parseDefinition(snapshot.getDefinitionJson(), "已发布流程版本快照无法解析，拒绝运行"));
            dto.setStatus(projection.getStatus());
            dto.setVersion(projection.getVersion());
            dto.setUpdatedBy(projection.getUpdatedBy());
        }
        if (draft != null) {
            dto.setId(draft.getId());
            dto.setName(draft.getName());
            dto.setDescription(draft.getDescription());
            dto.setDefinition(parseDefinition(draft.getDefinitionJson(), "流程草稿无法解析"));
            dto.setStatus("DRAFT");
            dto.setVersion(draft.getRevision() == null ? 0 : draft.getRevision());
            dto.setRevision(draft.getRevision());
            dto.setUpdatedBy(draft.getUpdatedBy());
            dto.setCreateTime(draft.getCreateTime());
            dto.setUpdateTime(draft.getUpdateTime());
        }
        if (projection != null && projection.getId() != null && projection.getVersion() != null
                && projection.getVersion() > 0) {
            dto.setPublishedDefinitionId(projection.getId());
            dto.setPublishedVersion(projection.getVersion());
            dto.setPublishedStatus(projection.getStatus());
            dto.setPublishedAt(projection.getPublishedAt());
        }
        return dto;
    }

    private WorkflowDefinitionVersionDTO toVersionDto(WorkflowDefinitionVersion version) {
        validateSnapshot(version);
        WorkflowDefinitionVersionDTO dto = new WorkflowDefinitionVersionDTO();
        dto.setId(version.getId());
        dto.setDefinitionId(version.getDefinitionId());
        dto.setBusinessType(version.getBusinessType());
        dto.setVersion(version.getVersion());
        dto.setActionType(version.getActionType());
        dto.setStatus(version.getStatus());
        dto.setName(version.getName());
        dto.setDescription(version.getDescription());
        dto.setDefinition(parseDefinition(version.getDefinitionJson(), "流程版本快照无法解析"));
        dto.setPublishNote(version.getPublishNote());
        dto.setImpactScope(version.getImpactScope());
        dto.setRollbackPlan(version.getRollbackPlan());
        dto.setRollbackSourceVersion(version.getRollbackSourceVersion());
        dto.setOperatorId(version.getOperatorId());
        dto.setPublishedAt(version.getPublishedAt());
        dto.setCreateTime(version.getCreateTime());
        return dto;
    }

    private void validateSnapshot(WorkflowDefinitionVersion snapshot) {
        if (snapshot == null || !STATUS_PUBLISHED.equals(snapshot.getStatus())
                || snapshot.getDefinitionJson() == null || snapshot.getDefinitionJson().isBlank()) {
            throw new BusinessException("已发布流程版本快照缺失，拒绝运行");
        }
        validateDefinitionJson(snapshot.getDefinitionJson());
    }

    private void validateDefinitionJson(String definitionJson) {
        LinearWorkflowDefinitionValidator.ValidationResult result =
                LinearWorkflowDefinitionValidator.validate(parseDefinition(definitionJson, "流程定义无法解析"));
        if (!result.valid()) {
            throw new BusinessException("流程图校验失败：" + String.join("；", result.errors()));
        }
    }

    private FlowDesignerValidationResultDTO toValidationResult(LinearWorkflowDefinitionValidator.ValidationResult validation) {
        FlowDesignerValidationResultDTO result = new FlowDesignerValidationResultDTO();
        result.setErrors(validation.errors());
        result.setWarnings(validation.warnings());
        result.setNodeCount(validation.nodeCount());
        result.setEdgeCount(validation.edgeCount());
        result.setValid(validation.valid());
        return result;
    }

    private Map<String, Object> toDefinitionMap(FlowDesignerGraphDTO graph) {
        Map<String, Object> definition = new LinkedHashMap<>();
        if (graph == null) {
            definition.put("nodes", List.of());
            definition.put("edges", List.of());
            return definition;
        }
        definition.put("id", graph.getId());
        definition.put("name", graph.getName());
        definition.put("description", graph.getDescription());
        definition.put("nodes", graph.getNodes() == null ? List.of() : graph.getNodes().stream().map(this::toNodeMap).toList());
        definition.put("edges", graph.getEdges() == null ? List.of() : graph.getEdges().stream().map(this::toEdgeMap).toList());
        definition.putAll(graph.getAdditionalProperties());
        return definition;
    }

    private Map<String, Object> toNodeMap(FlowDesignerGraphDTO.NodeDTO node) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", node.getId());
        map.put("type", node.getType());
        map.put("label", node.getLabel());
        if (node.getConfig() != null) {
            map.put("config", node.getConfig());
        }
        map.putAll(node.getAdditionalProperties());
        return map;
    }

    private Map<String, Object> toEdgeMap(FlowDesignerGraphDTO.EdgeDTO edge) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", edge.getId());
        map.put("source", edge.getSource());
        map.put("target", edge.getTarget());
        map.put("label", edge.getLabel());
        map.put("sourceHandle", edge.getSourceHandle());
        map.put("targetHandle", edge.getTargetHandle());
        map.put("conditionExpression", edge.getConditionExpression());
        map.put("condition", edge.getCondition());
        map.putAll(edge.getAdditionalProperties());
        return map;
    }

    private Map<String, Object> parseDefinition(String json, String errorMessage) {
        if (json == null || json.isBlank()) {
            throw new BusinessException(errorMessage);
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() { });
        } catch (JsonProcessingException | IllegalArgumentException exception) {
            throw new BusinessException(errorMessage);
        }
    }

    private String toJson(Map<String, Object> definition) {
        try {
            return objectMapper.writeValueAsString(definition);
        } catch (JsonProcessingException exception) {
            throw new BusinessException("流程定义序列化失败");
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

    private WorkflowTemplate requireTemplate(String businessType) {
        return TEMPLATES.stream()
                .filter(template -> template.businessType().equals(businessType))
                .findFirst()
                .orElseThrow(() -> new BusinessException("不支持的业务流程类型"));
    }

    private Long requireOperatorId(Long operatorId) {
        if (operatorId == null || operatorId <= 0) {
            throw new BusinessException("流程设计器操作人不能为空");
        }
        return operatorId;
    }

    private Integer requireExpectedDraftRevision(Integer expectedRevision, String actionName) {
        if (expectedRevision == null || expectedRevision < 0) {
            throw new BusinessException(actionName + "操作需要携带已审阅的草稿 revision");
        }
        return expectedRevision;
    }

    private Integer requireExpectedPublishedVersion(FlowDesignerOperationDTO operation) {
        Integer expectedPublishedVersion = operation == null ? null : operation.getExpectedPublishedVersion();
        if (expectedPublishedVersion == null || expectedPublishedVersion <= 0) {
            throw new BusinessException("回滚操作需要携带已审阅的当前已发布版本");
        }
        return expectedPublishedVersion;
    }

    private int requireDraftRevision(WorkflowDefinitionDraft draft) {
        if (draft == null || draft.getRevision() == null || draft.getRevision() < 0) {
            throw new BusinessException("流程草稿 revision 不合法");
        }
        return draft.getRevision();
    }

    private int nextDraftRevision(int currentRevision) {
        try {
            return Math.incrementExact(currentRevision);
        } catch (ArithmeticException exception) {
            throw new BusinessException("流程草稿 revision 已达到上限");
        }
    }

    private void requireMatchingDraftRevision(WorkflowDefinitionDraft draft, Integer expectedRevision, String actionName) {
        int currentRevision = requireDraftRevision(draft);
        if (expectedRevision != currentRevision) {
            throw draftConflict(actionName + "前草稿已更新（当前 revision=" + currentRevision + "），请重新审阅后重试");
        }
    }

    private void verifyRollbackDraftReview(String tenantId, String businessType, FlowDesignerOperationDTO operation) {
        Integer expectedRevision = operation == null ? null : operation.getExpectedDraftRevision();
        boolean expectedAbsent = operation != null && Boolean.TRUE.equals(operation.getExpectedDraftAbsent());
        if (expectedAbsent && expectedRevision != null) {
            throw new BusinessException("回滚草稿审阅基线不能同时声明 revision 和不存在");
        }
        if (!expectedAbsent && expectedRevision == null) {
            throw new BusinessException("回滚操作需要携带已审阅的草稿 revision，或显式确认无草稿基线");
        }
        if (expectedRevision != null && expectedRevision < 0) {
            throw new BusinessException("回滚操作携带的草稿 revision 不合法");
        }
        WorkflowDefinitionDraft draft = findDraftForUpdate(tenantId, businessType);
        if (expectedAbsent) {
            if (draft != null) {
                throw draftConflict("草稿已被创建或更新，请重新审阅后再回滚");
            }
            return;
        }
        if (draft == null) {
            throw draftConflict("已审阅的草稿不存在，请重新审阅后再回滚");
        }
        requireMatchingDraftRevision(draft, expectedRevision, "回滚");
    }

    private ConflictException draftConflict(String message) {
        return new ConflictException(message);
    }

    private void requireConfirmed(FlowDesignerOperationDTO operation, String actionName) {
        if (operation == null || !Boolean.TRUE.equals(operation.getConfirmed())) {
            throw new BusinessException(actionName + "操作需要二次确认");
        }
    }

    private String requireAuditReason(FlowDesignerOperationDTO operation, String actionName) {
        String reason = firstPresent(operation == null ? null : operation.getReason(),
                operation == null ? null : operation.getPublishNote());
        if (reason == null || reason.isBlank()) {
            throw new BusinessException(actionName + "操作需要审计原因");
        }
        return reason;
    }

    private void requireAuditEvidence(FlowDesignerOperationDTO operation, String actionName) {
        if (operation == null || operation.getImpactScope() == null || operation.getImpactScope().isBlank()) {
            throw new BusinessException(actionName + "操作需要影响范围");
        }
        if (operation.getRollbackPlan() == null || operation.getRollbackPlan().isBlank()) {
            throw new BusinessException(actionName + "操作需要回滚预案");
        }
    }

    private boolean isPublishedProjection(WorkflowDefinition definition) {
        return definition != null && definition.getVersion() != null && definition.getVersion() > 0
                && (STATUS_PUBLISHED.equals(definition.getStatus()) || STATUS_DISABLED.equals(definition.getStatus()));
    }

    private String firstPresent(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private record WorkflowTemplate(String businessType, String name, String description) {
    }
}
