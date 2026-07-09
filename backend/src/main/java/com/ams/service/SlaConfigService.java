package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SlaConfigDTO;
import com.ams.dto.SlaConfigOperationDTO;
import com.ams.dto.SlaConfigSaveDTO;
import com.ams.dto.SlaConfigSimulationDTO;
import com.ams.dto.SlaConfigSimulationResultDTO;
import com.ams.dto.SlaRuntimeSummaryDTO;
import com.ams.dto.SlaTimeoutExportDTO;
import com.ams.dto.SlaTimeoutRecordDTO;
import com.ams.entity.SlaConfig;
import com.ams.entity.SlaTimeoutRecord;
import com.ams.mapper.SlaConfigMapper;
import com.ams.mapper.SlaTimeoutRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SlaConfigService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_DISABLED = "DISABLED";
    private static final Pattern SAFE_KEY_PATTERN = Pattern.compile("^[A-Za-z][A-Za-z0-9_:-]{0,63}$");
    private static final Set<String> PROTOTYPE_KEYS = Set.of("__proto__", "constructor", "prototype");
    private static final TypeReference<List<Map<String, String>>> TARGET_LIST_TYPE = new TypeReference<>() {};

    private final SlaConfigMapper slaConfigMapper;
    private final SlaTimeoutRecordMapper slaTimeoutRecordMapper;
    private final ObjectMapper objectMapper;

    public List<SlaConfigDTO> listConfigs(String processKey, String businessType, String status, String priority) {
        String tenantId = TenantContext.requireTenantId();
        LambdaQueryWrapper<SlaConfig> wrapper = new LambdaQueryWrapper<SlaConfig>()
                .eq(SlaConfig::getTenantId, tenantId);
        if (hasText(processKey)) {
            wrapper.eq(SlaConfig::getProcessKey, requireSafeKey(processKey, "流程标识不合法"));
        }
        if (hasText(businessType)) {
            wrapper.eq(SlaConfig::getBusinessType, requireSafeKey(businessType, "业务类型不合法"));
        }
        if (hasText(status)) {
            wrapper.eq(SlaConfig::getStatus, normalizeStatus(status));
        }
        if (hasText(priority)) {
            wrapper.eq(SlaConfig::getPriority, normalizePriority(priority));
        }
        wrapper.orderByAsc(SlaConfig::getProcessKey).orderByAsc(SlaConfig::getNodeKey).orderByAsc(SlaConfig::getPriority).orderByDesc(SlaConfig::getUpdateTime);
        List<SlaConfig> configs = slaConfigMapper.selectList(wrapper);
        return (configs == null ? List.<SlaConfig>of() : configs).stream().map(this::toDto).toList();
    }

    public SlaConfigDTO getConfig(Long configId) {
        return toDto(requireConfig(TenantContext.requireTenantId(), configId));
    }

    @Transactional(rollbackFor = Exception.class)
    public SlaConfigDTO updateConfig(Long configId, SlaConfigSaveDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        SlaConfig existing = requireConfig(tenantId, configId);
        SlaConfigSaveDTO payload = dto == null ? new SlaConfigSaveDTO() : dto;
        Long operatorId = requireAuditedOperator(payload.getOperatorId(), payload.getReason(), payload.getAuditEvidence(), "SLA策略更新");

        existing.setProcessKey(hasText(payload.getProcessKey()) ? requireSafeKey(payload.getProcessKey(), "流程标识不合法") : firstPresent(existing.getProcessKey(), "GLOBAL"));
        existing.setBusinessType(hasText(payload.getBusinessType()) ? requireSafeKey(payload.getBusinessType(), "业务类型不合法") : firstPresent(existing.getBusinessType(), existing.getProcessKey()));
        existing.setNodeKey(hasText(payload.getNodeKey()) ? requireSafeKey(payload.getNodeKey(), "节点标识不合法") : firstPresent(existing.getNodeKey(), "ALL"));
        existing.setPriority(hasText(payload.getPriority()) ? normalizePriority(payload.getPriority()) : firstPresent(existing.getPriority(), "NORMAL"));
        Integer responseHours = payload.getResponseHours() == null ? firstPositive(existing.getResponseHours(), 4) : requireHours(payload.getResponseHours(), "响应时限不合法");
        Integer resolveHours = payload.getResolveHours() == null ? firstPositive(existing.getResolveHours(), Math.max(responseHours, 24)) : requireHours(payload.getResolveHours(), "解决时限不合法");
        Double warningRatio = payload.getWarningRatio() == null ? firstRatio(existing.getWarningRatio(), 0.75D) : requireRatio(payload.getWarningRatio(), "预警阈值不合法");
        Double escalationRatio = payload.getEscalationRatio() == null ? firstRatio(existing.getEscalationRatio(), Math.max(warningRatio, 0.9D)) : requireRatio(payload.getEscalationRatio(), "升级阈值不合法");
        validateThresholds(responseHours, resolveHours, warningRatio, escalationRatio);
        existing.setResponseHours(responseHours);
        existing.setResolveHours(resolveHours);
        existing.setWarningRatio(warningRatio);
        existing.setEscalationRatio(escalationRatio);
        if (payload.getNotificationTargets() != null) {
            existing.setNotificationTargets(writeTargets(sanitizeNotificationTargets(payload.getNotificationTargets())));
        }
        if (payload.getEnabled() != null) {
            existing.setStatus(Boolean.TRUE.equals(payload.getEnabled()) ? STATUS_ACTIVE : STATUS_DISABLED);
        } else if (payload.getStatus() != null) {
            existing.setStatus(payload.getStatus() == 1 ? STATUS_ACTIVE : STATUS_DISABLED);
        } else if (!hasText(existing.getStatus())) {
            existing.setStatus(STATUS_DISABLED);
        }
        existing.setUpdatedBy(operatorId);
        existing.setAuditSummary("SLA策略更新，旧合同兼容且敏感字段已脱敏；" + auditText(payload.getReason(), payload.getAuditEvidence()));
        slaConfigMapper.updateById(existing);
        return toDto(existing);
    }

    @Transactional(rollbackFor = Exception.class)
    public SlaConfigDTO enableConfig(Long configId, SlaConfigOperationDTO operation) {
        return changeStatus(configId, operation, STATUS_ACTIVE, "启用SLA策略");
    }

    @Transactional(rollbackFor = Exception.class)
    public SlaConfigDTO disableConfig(Long configId, SlaConfigOperationDTO operation) {
        return changeStatus(configId, operation, STATUS_DISABLED, "停用SLA策略");
    }

    public SlaConfigSimulationResultDTO simulate(SlaConfigSimulationDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        SlaConfigSimulationDTO payload = dto == null ? new SlaConfigSimulationDTO() : dto;
        requireConfirmedAudit(payload.getConfirmed(), payload.getOperatorId(), payload.getReason(), payload.getAuditEvidence(), "SLA策略模拟");
        rejectUnsafeVariables(payload.getVariables());
        String processKey = requireSafeKey(payload.getProcessKey(), "流程标识不合法");
        String businessType = hasText(payload.getBusinessType()) ? requireSafeKey(payload.getBusinessType(), "业务类型不合法") : processKey;
        String nodeKey = requireSafeKey(payload.getNodeKey(), "节点标识不合法");
        String priority = hasText(payload.getPriority()) ? normalizePriority(payload.getPriority()) : "NORMAL";

        List<SlaConfig> configs = slaConfigMapper.selectList(new LambdaQueryWrapper<SlaConfig>()
                .eq(SlaConfig::getTenantId, tenantId)
                .eq(SlaConfig::getStatus, STATUS_ACTIVE));
        List<SlaConfig> candidates = (configs == null ? List.<SlaConfig>of() : configs).stream()
                .filter(config -> matches(config, processKey, businessType, nodeKey, priority))
                .sorted(Comparator.comparingInt((SlaConfig config) -> matchScore(config, processKey, businessType, nodeKey, priority)).reversed()
                        .thenComparing(SlaConfig::getResolveHours, Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(SlaConfig::getId, Comparator.nullsLast(Long::compareTo)))
                .toList();

        SlaConfigSimulationResultDTO result = new SlaConfigSimulationResultDTO();
        result.setProcessKey(processKey);
        result.setBusinessType(businessType);
        result.setNodeKey(nodeKey);
        result.setPriority(priority);
        result.setTenantScoped(true);
        result.setSimulatedAt(LocalDateTime.now());
        result.setVariablePreviewMasked(maskVariables(payload.getVariables()));
        result.setSafeExplanation("只读模拟完成：未发送真实通知，未读取附件或上传目录，未修改审批、工作流定义、表单实例、业务单据或任务状态。");
        result.setAuditSummary("SLA策略模拟；" + auditText(payload.getReason(), payload.getAuditEvidence()));
        if (candidates.isEmpty()) {
            result.setPolicySummary("未匹配启用SLA策略");
            result.getWarnings().add("未命中启用策略，请检查流程、业务类型、节点、优先级和启用状态。");
            return result;
        }

        SlaConfig config = candidates.get(0);
        LocalDateTime startedAt = firstTime(payload.getNodeStartedAt(), payload.getTaskArrivedAt(), payload.getProcessStartedAt(), LocalDateTime.now());
        Integer responseHours = firstPositive(config.getResponseHours(), 4);
        Integer resolveHours = firstPositive(config.getResolveHours(), Math.max(responseHours, 24));
        Double warningRatio = firstRatio(config.getWarningRatio(), 0.75D);
        Double escalationRatio = firstRatio(config.getEscalationRatio(), Math.max(warningRatio, 0.9D));
        validateThresholds(responseHours, resolveHours, warningRatio, escalationRatio);
        LocalDateTime responseDueAt = startedAt.plusHours(responseHours);
        LocalDateTime resolveDueAt = startedAt.plusHours(resolveHours);
        LocalDateTime warningAt = startedAt.plusMinutes(Math.round(resolveHours * 60D * warningRatio));
        LocalDateTime escalationAt = startedAt.plusMinutes(Math.round(resolveHours * 60D * escalationRatio));
        result.setMatchedConfigId(config.getId());
        result.setPolicySummary("命中策略：" + firstPresent(config.getProcessKey(), "GLOBAL") + "/" + firstPresent(config.getNodeKey(), "ALL") + "/" + firstPresent(config.getPriority(), "NORMAL"));
        result.setResponseHours(responseHours);
        result.setResolveHours(resolveHours);
        result.setResponseDueAt(responseDueAt);
        result.setResolveDueAt(resolveDueAt);
        result.setWarningAt(warningAt);
        result.setEscalationAt(escalationAt);
        result.setRemainingMinutes(Duration.between(LocalDateTime.now(), resolveDueAt).toMinutes());
        result.setNotificationTargets(parseTargets(config.getNotificationTargets()));
        result.getReminders().add("预警时间 " + warningAt + "，仅生成待发送建议，不触达外部通知渠道。");
        result.getEscalationSuggestions().add("升级时间 " + escalationAt + "，通知目标仅返回 masked 摘要。");
        return result;
    }

    public SlaRuntimeSummaryDTO runtimeSummary() {
        String tenantId = TenantContext.requireTenantId();
        List<SlaConfig> configs = safeConfigs(slaConfigMapper.selectList(new LambdaQueryWrapper<SlaConfig>().eq(SlaConfig::getTenantId, tenantId)));
        List<SlaTimeoutRecord> records = safeRecords(slaTimeoutRecordMapper.selectList(new LambdaQueryWrapper<SlaTimeoutRecord>()
                .eq(SlaTimeoutRecord::getTenantId, tenantId)
                .orderByDesc(SlaTimeoutRecord::getTimeoutAt)
                .orderByDesc(SlaTimeoutRecord::getId)));
        SlaRuntimeSummaryDTO summary = new SlaRuntimeSummaryDTO();
        summary.setTotalConfigs(configs.size());
        summary.setActiveConfigs((int) configs.stream().filter(config -> STATUS_ACTIVE.equals(config.getStatus())).count());
        summary.setTimeoutRecordCount(records.size());
        Map<String, Integer> riskCounts = new LinkedHashMap<>();
        for (SlaTimeoutRecord record : records) {
            String risk = firstPresent(record.getRiskLevel(), "UNKNOWN").toUpperCase(Locale.ROOT);
            riskCounts.put(risk, riskCounts.getOrDefault(risk, 0) + 1);
        }
        summary.setRiskCounts(riskCounts);
        summary.setCriticalCount(riskCounts.getOrDefault("CRITICAL", 0));
        summary.setOverdueCount((int) records.stream().filter(record -> "OPEN".equalsIgnoreCase(record.getStatus()) || "OVERDUE".equalsIgnoreCase(record.getStatus())).count());
        summary.setWarningCount(riskCounts.getOrDefault("HIGH", 0) + riskCounts.getOrDefault("MEDIUM", 0));
        summary.setRecentTimeoutRecords(records.stream().limit(5).map(this::toRecordDto).toList());
        summary.setNodeDurationSummary(records.stream().limit(5)
                .map(record -> firstPresent(record.getNodeName(), record.getNodeKey(), "节点") + " 超时 " + firstPositive(record.getTimeoutMinutes(), 0L) + " 分钟，风险 " + firstPresent(record.getRiskLevel(), "UNKNOWN"))
                .toList());
        summary.setAbnormalTraceSummary(records.stream().limit(5)
                .map(record -> "实例 " + maskIdentifier(record.getProcessInstanceId()) + " 的 " + firstPresent(record.getNodeKey(), "节点") + " 存在SLA异常轨迹，业务摘要已脱敏。")
                .toList());
        summary.setExportMaskingNotice("导出仅返回 masked/summary 字段，不包含联系方式、变量原文、附件路径或 storage key。");
        summary.setReadOnly(true);
        summary.setTenantScoped(true);
        summary.setGeneratedAt(LocalDateTime.now());
        return summary;
    }

    public List<SlaTimeoutRecordDTO> listTimeoutRecords(String processKey, String nodeKey, String status, String riskLevel) {
        String tenantId = TenantContext.requireTenantId();
        LambdaQueryWrapper<SlaTimeoutRecord> wrapper = new LambdaQueryWrapper<SlaTimeoutRecord>()
                .eq(SlaTimeoutRecord::getTenantId, tenantId);
        if (hasText(processKey)) {
            wrapper.eq(SlaTimeoutRecord::getProcessKey, requireSafeKey(processKey, "流程标识不合法"));
        }
        if (hasText(nodeKey)) {
            wrapper.eq(SlaTimeoutRecord::getNodeKey, requireSafeKey(nodeKey, "节点标识不合法"));
        }
        if (hasText(status)) {
            wrapper.eq(SlaTimeoutRecord::getStatus, normalizeSimpleText(status, "超时记录状态不合法"));
        }
        if (hasText(riskLevel)) {
            wrapper.eq(SlaTimeoutRecord::getRiskLevel, normalizeSimpleText(riskLevel, "风险等级不合法"));
        }
        wrapper.orderByDesc(SlaTimeoutRecord::getTimeoutAt).orderByDesc(SlaTimeoutRecord::getId);
        return safeRecords(slaTimeoutRecordMapper.selectList(wrapper)).stream().map(this::toRecordDto).toList();
    }

    public SlaTimeoutExportDTO exportTimeoutRecords(SlaTimeoutExportDTO request) {
        String tenantId = TenantContext.requireTenantId();
        SlaTimeoutExportDTO payload = request == null ? new SlaTimeoutExportDTO() : request;
        requireConfirmedAudit(payload.getConfirmed(), payload.getOperatorId(), payload.getReason(), payload.getAuditEvidence(), "SLA脱敏导出");
        List<SlaTimeoutRecordDTO> records = listTimeoutRecords(payload.getProcessKey(), payload.getNodeKey(), payload.getStatus(), payload.getRiskLevel());
        List<SlaConfigDTO> configs = safeConfigs(slaConfigMapper.selectList(new LambdaQueryWrapper<SlaConfig>().eq(SlaConfig::getTenantId, tenantId))).stream()
                .map(this::toDto)
                .toList();
        SlaTimeoutExportDTO result = new SlaTimeoutExportDTO();
        result.setProcessKey(payload.getProcessKey());
        result.setNodeKey(payload.getNodeKey());
        result.setStatus(payload.getStatus());
        result.setRiskLevel(payload.getRiskLevel());
        result.setOperatorId(payload.getOperatorId());
        result.setMasked(true);
        result.setExportedBy(String.valueOf(payload.getOperatorId()));
        result.setExportedAt(LocalDateTime.now());
        result.setFilterSummary("tenant=" + tenantId + ", processKey=" + firstPresent(payload.getProcessKey(), "ALL") + ", nodeKey=" + firstPresent(payload.getNodeKey(), "ALL") + ", status=" + firstPresent(payload.getStatus(), "ALL") + ", risk=" + firstPresent(payload.getRiskLevel(), "ALL"));
        result.setFieldMaskingPolicy("联系方式、通知目标、变量值、附件路径、storage key、业务字段原文均只保留 masked/summary。 ");
        result.setRecords(records);
        result.setConfigs(configs);
        result.setRecordCount(records.size());
        result.setContentSummary("导出快照已脱敏，共 " + records.size() + " 条超时记录、" + configs.size() + " 条策略摘要；未读取 uploads。 ");
        return result;
    }

    private SlaConfigDTO changeStatus(Long configId, SlaConfigOperationDTO operation, String nextStatus, String actionName) {
        String tenantId = TenantContext.requireTenantId();
        requireHighRiskOperation(operation, actionName);
        SlaConfig config = requireConfig(tenantId, configId);
        config.setStatus(nextStatus);
        config.setUpdatedBy(operation.getOperatorId());
        if (STATUS_ACTIVE.equals(nextStatus)) {
            config.setEnabledBy(operation.getOperatorId());
            config.setEnabledAt(LocalDateTime.now());
        } else {
            config.setDisabledBy(operation.getOperatorId());
            config.setDisabledAt(LocalDateTime.now());
            config.setDisabledReason(firstPresent(operation.getReason(), operation.getAuditEvidence()));
        }
        config.setAuditSummary(actionName + "，仅影响后续流程实例、后续任务和后续SLA计算；" + auditText(operation.getReason(), operation.getAuditEvidence()));
        slaConfigMapper.updateById(config);
        return toDto(config);
    }

    private SlaConfig requireConfig(String tenantId, Long configId) {
        if (configId == null || configId <= 0) {
            throw new BusinessException("SLA策略不存在");
        }
        SlaConfig config = slaConfigMapper.selectOne(new LambdaQueryWrapper<SlaConfig>()
                .eq(SlaConfig::getTenantId, tenantId)
                .eq(SlaConfig::getId, configId)
                .last("limit 1"));
        if (config == null) {
            throw new BusinessException("SLA策略不存在或无权访问");
        }
        return config;
    }

    private SlaConfigDTO toDto(SlaConfig config) {
        SlaConfigDTO dto = new SlaConfigDTO();
        dto.setId(config.getId());
        dto.setProcessKey(config.getProcessKey());
        dto.setBusinessType(config.getBusinessType());
        dto.setNodeKey(config.getNodeKey());
        dto.setPriority(config.getPriority());
        dto.setResponseHours(config.getResponseHours());
        dto.setResolveHours(config.getResolveHours());
        dto.setWarningRatio(config.getWarningRatio());
        dto.setEscalationRatio(config.getEscalationRatio());
        dto.setStatus(STATUS_ACTIVE.equals(config.getStatus()) ? 1 : 0);
        dto.setStatusText(STATUS_ACTIVE.equals(config.getStatus()) ? "ACTIVE" : "DISABLED");
        dto.setEnabled(STATUS_ACTIVE.equals(config.getStatus()));
        List<Map<String, String>> targets = parseTargets(config.getNotificationTargets());
        dto.setNotificationTargets(targets);
        dto.setNotificationTargetSummary(targets.isEmpty() ? "暂无通知目标" : "通知目标 " + targets.size() + " 个，联系方式已脱敏");
        dto.setContactMasked(targets.stream().map(target -> target.getOrDefault("contactMasked", "***")).collect(Collectors.joining("；")));
        dto.setVariablePreviewMasked("变量值仅提供 masked/summary，不返回原文");
        dto.setApplicableProcessSummary(firstPresent(config.getProcessKey(), "GLOBAL") + "/" + firstPresent(config.getBusinessType(), "ALL") + "/" + firstPresent(config.getNodeKey(), "ALL") + "/" + firstPresent(config.getPriority(), "NORMAL"));
        dto.setAuditSummary(config.getAuditSummary());
        dto.setUpdatedBy(config.getUpdatedBy());
        dto.setEnabledAt(config.getEnabledAt());
        dto.setDisabledAt(config.getDisabledAt());
        dto.setDisabledReason(config.getDisabledReason());
        dto.setCreateTime(config.getCreateTime());
        dto.setUpdateTime(config.getUpdateTime());
        return dto;
    }

    private SlaTimeoutRecordDTO toRecordDto(SlaTimeoutRecord record) {
        SlaTimeoutRecordDTO dto = new SlaTimeoutRecordDTO();
        dto.setId(record.getId());
        dto.setConfigId(record.getConfigId());
        dto.setProcessInstanceId(maskIdentifier(record.getProcessInstanceId()));
        dto.setProcessKey(record.getProcessKey());
        dto.setBusinessType(record.getBusinessType());
        dto.setNodeKey(record.getNodeKey());
        dto.setNodeName(firstPresent(record.getNodeName(), "节点摘要已脱敏"));
        dto.setPriority(record.getPriority());
        dto.setResponseDueAt(record.getResponseDueAt());
        dto.setResolveDueAt(record.getResolveDueAt());
        dto.setTimeoutAt(record.getTimeoutAt());
        dto.setTimeoutMinutes(record.getTimeoutMinutes());
        dto.setRiskLevel(record.getRiskLevel());
        dto.setStatus(record.getStatus());
        dto.setMaskedBusinessSummary(firstPresent(maskText(record.getMaskedBusinessSummary()), "业务摘要已脱敏"));
        dto.setApplicantMasked(firstPresent(maskText(record.getApplicantMasked()), "申请人***"));
        dto.setAssigneeMasked(firstPresent(maskText(record.getAssigneeMasked()), "处理人***"));
        dto.setAuditSummary(firstPresent(record.getAuditSummary(), "超时记录只读，业务字段已脱敏"));
        dto.setMasked(true);
        dto.setCreateTime(record.getCreateTime());
        dto.setUpdateTime(record.getUpdateTime());
        return dto;
    }

    private List<Map<String, String>> parseTargets(String text) {
        if (!hasText(text)) {
            return List.of();
        }
        try {
            return sanitizeNotificationTargets(objectMapper.readValue(text, TARGET_LIST_TYPE));
        } catch (JsonProcessingException ex) {
            return List.of(Map.of("targetType", "UNKNOWN", "targetNameMasked", "目标***", "contactMasked", "***"));
        }
    }

    private String writeTargets(List<Map<String, String>> targets) {
        try {
            return objectMapper.writeValueAsString(targets);
        } catch (JsonProcessingException ex) {
            throw new BusinessException("SLA通知目标脱敏摘要生成失败");
        }
    }

    private List<Map<String, String>> sanitizeNotificationTargets(List<Map<String, String>> targets) {
        if (targets == null) {
            return List.of();
        }
        List<Map<String, String>> result = new ArrayList<>();
        for (Map<String, String> target : targets) {
            if (target == null) {
                continue;
            }
            Map<String, String> item = new LinkedHashMap<>();
            item.put("targetType", normalizeSimpleText(firstPresent(target.get("targetType"), target.get("type"), "ROLE"), "通知目标类型不合法"));
            item.put("targetNameMasked", maskName(firstPresent(target.get("targetNameMasked"), target.get("targetName"), target.get("name"), "通知目标")));
            item.put("contactMasked", maskContact(firstPresent(target.get("contactMasked"), target.get("contact"), target.get("email"), target.get("phone"), "")));
            result.add(item);
        }
        return result;
    }

    private boolean matches(SlaConfig config, String processKey, String businessType, String nodeKey, String priority) {
        return matchesScope(config.getProcessKey(), processKey, "GLOBAL", "ALL")
                && matchesScope(config.getBusinessType(), businessType, "GLOBAL", "ALL")
                && matchesScope(config.getNodeKey(), nodeKey, "ALL", "*")
                && matchesScope(config.getPriority(), priority, "ALL", "NORMAL");
    }

    private boolean matchesScope(String configured, String actual, String... wildcardValues) {
        if (!hasText(configured)) {
            return true;
        }
        String normalized = configured.trim();
        for (String wildcard : wildcardValues) {
            if (normalized.equalsIgnoreCase(wildcard)) {
                return true;
            }
        }
        return normalized.equalsIgnoreCase(actual);
    }

    private int matchScore(SlaConfig config, String processKey, String businessType, String nodeKey, String priority) {
        int score = 0;
        if (same(config.getProcessKey(), processKey)) score += 100;
        if (same(config.getNodeKey(), nodeKey)) score += 80;
        if (same(config.getBusinessType(), businessType)) score += 40;
        if (same(config.getPriority(), priority)) score += 20;
        return score;
    }

    private boolean same(String left, String right) {
        return hasText(left) && hasText(right) && left.equalsIgnoreCase(right);
    }

    private void validateThresholds(Integer responseHours, Integer resolveHours, Double warningRatio, Double escalationRatio) {
        if (responseHours > resolveHours) {
            throw new BusinessException("响应时限不能大于解决时限");
        }
        if (warningRatio <= 0D || warningRatio > 1D || escalationRatio < warningRatio || escalationRatio > 1D) {
            throw new BusinessException("SLA提醒阈值不合法");
        }
    }

    private void requireHighRiskOperation(SlaConfigOperationDTO operation, String actionName) {
        if (operation == null) {
            throw new BusinessException(actionName + "需要二次确认");
        }
        requireConfirmedAudit(operation.getConfirmed(), operation.getOperatorId(), operation.getReason(), operation.getAuditEvidence(), actionName);
    }

    private void requireConfirmedAudit(Boolean confirmed, Long operatorId, String reason, String auditEvidence, String actionName) {
        if (!Boolean.TRUE.equals(confirmed)) {
            throw new BusinessException(actionName + "需要二次确认");
        }
        requireAuditedOperator(operatorId, reason, auditEvidence, actionName);
    }

    private Long requireAuditedOperator(Long operatorId, String reason, String auditEvidence, String actionName) {
        if (operatorId == null || operatorId <= 0) {
            throw new BusinessException(actionName + "需要操作人");
        }
        if (!hasText(reason) && !hasText(auditEvidence)) {
            throw new BusinessException(actionName + "需要审计原因或审计证据");
        }
        return operatorId;
    }

    private void rejectUnsafeVariables(Map<String, Object> variables) {
        if (variables == null) {
            return;
        }
        for (String key : variables.keySet()) {
            String lower = Objects.toString(key, "").toLowerCase(Locale.ROOT);
            if (PROTOTYPE_KEYS.contains(lower)) {
                throw new BusinessException("SLA模拟变量包含不安全字段");
            }
        }
    }

    private String maskVariables(Map<String, Object> variables) {
        if (variables == null || variables.isEmpty()) {
            return "未提供变量；模拟未读取业务字段原文";
        }
        return "变量 " + variables.size() + " 项已脱敏：" + variables.keySet().stream().limit(5).map(key -> key + "=***").collect(Collectors.joining("、"));
    }

    private String requireSafeKey(String key, String message) {
        String value = textValue(key);
        if (!SAFE_KEY_PATTERN.matcher(value).matches()) {
            throw new BusinessException(message);
        }
        return value;
    }

    private String normalizePriority(String priority) {
        String value = normalizeSimpleText(priority, "优先级不合法").toUpperCase(Locale.ROOT);
        if (value.length() > 32) {
            throw new BusinessException("优先级不合法");
        }
        return value;
    }

    private String normalizeStatus(String status) {
        String value = normalizeSimpleText(status, "SLA策略状态不合法").toUpperCase(Locale.ROOT);
        if (Set.of(STATUS_ACTIVE, STATUS_DISABLED).contains(value)) {
            return value;
        }
        if ("1".equals(value) || "ENABLED".equals(value)) {
            return STATUS_ACTIVE;
        }
        if ("0".equals(value)) {
            return STATUS_DISABLED;
        }
        throw new BusinessException("SLA策略状态不合法");
    }

    private String normalizeSimpleText(String value, String message) {
        String text = textValue(value).replace("%", "").replace("_", "");
        if (text.isBlank() || text.length() > 64 || !Pattern.compile("^[A-Za-z0-9_:-]+$").matcher(text).matches()) {
            throw new BusinessException(message);
        }
        return text;
    }

    private Integer requireHours(Integer hours, String message) {
        if (hours == null || hours < 1 || hours > 8760) {
            throw new BusinessException(message);
        }
        return hours;
    }

    private Double requireRatio(Double ratio, String message) {
        if (ratio == null || ratio <= 0D || ratio > 1D) {
            throw new BusinessException(message);
        }
        return ratio;
    }

    private String maskName(String value) {
        String text = textValue(value);
        if (text.isBlank()) {
            return "目标***";
        }
        return text.substring(0, 1) + "***";
    }

    private String maskContact(String value) {
        String text = textValue(value);
        if (text.isBlank() || "***".equals(text)) {
            return "***";
        }
        if (text.contains("@")) {
            return text.substring(0, 1) + "***（email）";
        }
        if (text.length() >= 4) {
            return text.substring(0, 1) + "***" + text.substring(text.length() - 1);
        }
        return "***";
    }

    private String maskText(String value) {
        String text = textValue(value);
        if (text.isBlank()) {
            return "";
        }
        if (text.contains("***") || text.contains("脱敏")) {
            return text.length() > 128 ? text.substring(0, 128) : text;
        }
        return text.substring(0, 1) + "***";
    }

    private String maskIdentifier(String value) {
        String text = textValue(value);
        if (text.isBlank()) {
            return "***";
        }
        if (text.length() <= 4) {
            return text.substring(0, 1) + "***";
        }
        return text.substring(0, 2) + "***" + text.substring(text.length() - 2);
    }

    private String auditText(String reason, String auditEvidence) {
        return firstPresent(reason, auditEvidence, "审计证据已登记");
    }

    private List<SlaConfig> safeConfigs(List<SlaConfig> configs) {
        return configs == null ? List.of() : configs;
    }

    private List<SlaTimeoutRecord> safeRecords(List<SlaTimeoutRecord> records) {
        return records == null ? List.of() : records;
    }

    private LocalDateTime firstTime(LocalDateTime... values) {
        for (LocalDateTime value : values) {
            if (value != null) {
                return value;
            }
        }
        return LocalDateTime.now();
    }

    private Integer firstPositive(Integer value, Integer fallback) {
        return value == null || value <= 0 ? fallback : value;
    }

    private Long firstPositive(Long value, Long fallback) {
        return value == null || value < 0 ? fallback : value;
    }

    private Double firstRatio(Double value, Double fallback) {
        return value == null || value <= 0D ? fallback : value;
    }

    private String firstPresent(String... values) {
        for (String value : values) {
            if (hasText(value)) {
                return value.trim();
            }
        }
        return "";
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String textValue(Object value) {
        return Objects.toString(value, "").trim();
    }
}
