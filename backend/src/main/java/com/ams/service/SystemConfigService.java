package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.SystemConfigDTO;
import com.ams.dto.SystemConfigOperationDTO;
import com.ams.dto.SystemConfigPreviewDTO;
import com.ams.dto.SystemConfigRefreshResultDTO;
import com.ams.dto.SystemConfigSaveDTO;
import com.ams.entity.SystemConfig;
import com.ams.mapper.SystemConfigMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SystemConfigService {

    private static final String GROUP_SYSTEM = "SYSTEM";
    private static final String GROUP_SECURITY = "SECURITY";
    private static final String OPERATION_CREATE = "CREATE";
    private static final String OPERATION_UPDATE = "UPDATE";
    private static final String OPERATION_DELETE = "DELETE";
    private static final String OPERATION_REFRESH = "REFRESH_CACHE";
    private static final String RISK_LOW = "LOW";
    private static final String RISK_MEDIUM = "MEDIUM";
    private static final String DEGRADED = "DEGRADED";
    private static final Set<String> ALLOWED_GROUPS = Set.of(GROUP_SYSTEM, GROUP_SECURITY);
    private static final Set<String> ALLOWED_TYPES = Set.of("STRING", "NUMBER", "BOOLEAN", "SELECT", "JSON", "Y", "N");
    private static final List<String> SYSTEM_IMPACT_MODULES = List.of("Workbench V3 system-base-params", "SYSTEM 配置读取", "系统参数缓存命名空间");
    private static final List<String> SECURITY_IMPACT_MODULES = List.of("Workbench V3 system-security-policy", "SECURITY 配置读取", "安全策略配置态预览");
    private static final Set<String> ALLOWED_REFRESH_NAMESPACES = Set.of("system-config:SYSTEM");
    private static final Set<String> SENSITIVE_KEYS = Set.of(
            "secret", "token", "password", "apikey", "privatekey", "clientsecret", "signingkey", "cert"
    );

    private final SystemConfigMapper systemConfigMapper;

    public Map<String, String> getGroupConfig(String configGroup) {
        String tenantId = TenantContext.requireTenantId();
        String group = normalizeGroup(configGroup);
        return safeList(systemConfigMapper.selectList(baseWrapper(tenantId, group).orderByAsc("config_key"))).stream()
                .collect(LinkedHashMap::new, (target, item) -> target.put(item.getConfigKey(), maskIfSensitive(item)), LinkedHashMap::putAll);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, String> saveGroupConfig(String configGroup, SystemConfigSaveDTO request, Long currentUserId) {
        String tenantId = TenantContext.requireTenantId();
        String group = normalizeGroup(configGroup);
        validateOperationRequest(request, currentUserId);
        Map<String, String> changes = extractChanges(request);
        if (changes.isEmpty()) {
            throw new BusinessException("系统参数保存内容不能为空");
        }
        for (Map.Entry<String, String> entry : changes.entrySet()) {
            upsertConfig(tenantId, group, entry.getKey(), entry.getValue(), request, currentUserId);
        }
        return getGroupConfig(group);
    }

    public Map<String, Object> listConfigs(Integer page, Integer pageSize, String configName, String configKey, String configGroup) {
        String tenantId = TenantContext.requireTenantId();
        String group = normalizeListGroup(configGroup);
        QueryWrapper<SystemConfig> wrapper = baseWrapper(tenantId, group).orderByDesc("update_time");
        if (hasText(configName)) {
            wrapper.like("config_name", configName.trim());
        }
        if (hasText(configKey)) {
            wrapper.like("config_key", configKey.trim());
        }
        List<SystemConfigDTO> all = safeList(systemConfigMapper.selectList(wrapper)).stream().map(this::toDTO).toList();
        int current = clamp(page, 1, 10_000, 1);
        int size = clamp(pageSize, 1, 100, 10);
        int from = Math.min((current - 1) * size, all.size());
        int to = Math.min(from + size, all.size());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("records", all.subList(from, to));
        result.put("total", all.size());
        result.put("size", size);
        result.put("current", current);
        result.put("pages", Math.max(1, (int) Math.ceil(all.size() / (double) size)));
        return result;
    }

    @Transactional(rollbackFor = Exception.class)
    public SystemConfigDTO create(SystemConfigSaveDTO request, Long currentUserId) {
        String tenantId = TenantContext.requireTenantId();
        validateOperationRequest(request, currentUserId);
        String group = normalizeWritableGroup(request == null ? null : request.getConfigGroup());
        String key = normalizeKey(request.getConfigKey());
        String type = normalizeType(request.getConfigType());
        String cleanValue = cleanValue(request.getConfigValue());
        validateConfigValue(group, key, cleanValue, type);
        ensureKeyAvailable(tenantId, group, key, null);

        LocalDateTime now = LocalDateTime.now();
        SystemConfig entity = new SystemConfig();
        entity.setTenantId(tenantId);
        entity.setConfigGroup(group);
        entity.setConfigKey(key);
        entity.setConfigValue(cleanValue);
        entity.setConfigName(cleanName(request.getConfigName(), key));
        entity.setConfigType(type);
        entity.setStatus(request.getStatus() == null ? 0 : request.getStatus());
        entity.setRemark(cleanAuditText(request.getRemark(), null));
        entity.setSensitiveMasked(isSensitiveKey(key));
        entity.setLastOperatorId(currentUserId);
        entity.setLastOperation(OPERATION_CREATE);
        entity.setLastOperationReason(cleanAuditText(request.getReason(), "新增系统基础参数"));
        entity.setAuditEvidenceSummary(buildAuditEvidenceSummary(request.getAuditEvidence(),
                auditSnapshot(key, null), auditSnapshot(key, cleanValue)));
        entity.setRemoved(0);
        entity.setCreateTime(now);
        entity.setUpdateTime(now);
        systemConfigMapper.insert(entity);
        return toDTO(entity);
    }

    @Transactional(rollbackFor = Exception.class)
    public SystemConfigDTO update(Long id, SystemConfigSaveDTO request, Long currentUserId) {
        String tenantId = TenantContext.requireTenantId();
        validateOperationRequest(request, currentUserId);
        SystemConfig entity = getRequired(tenantId, id);
        if (!GROUP_SYSTEM.equals(entity.getConfigGroup())) {
            throw new BusinessException("仅允许更新 SYSTEM 分组基础参数");
        }
        String previousKey = entity.getConfigKey();
        String previousValue = entity.getConfigValue();
        String key = hasText(request.getConfigKey()) ? normalizeKey(request.getConfigKey()) : entity.getConfigKey();
        String type = normalizeType(hasText(request.getConfigType()) ? request.getConfigType() : entity.getConfigType());
        String cleanValue = cleanValue(request.getConfigValue());
        validateConfigValue(GROUP_SYSTEM, key, cleanValue, type);
        ensureKeyAvailable(tenantId, GROUP_SYSTEM, key, id);
        entity.setConfigKey(key);
        entity.setConfigValue(cleanValue);
        entity.setConfigName(cleanName(request.getConfigName(), key));
        entity.setConfigType(type);
        if (request.getStatus() != null) {
            entity.setStatus(request.getStatus());
        }
        entity.setRemark(cleanAuditText(request.getRemark(), null));
        entity.setSensitiveMasked(isSensitiveKey(key));
        entity.setLastOperatorId(currentUserId);
        entity.setLastOperation(OPERATION_UPDATE);
        entity.setLastOperationReason(cleanAuditText(request.getReason(), "更新系统基础参数"));
        entity.setAuditEvidenceSummary(buildAuditEvidenceSummary(request.getAuditEvidence(),
                auditSnapshot(previousKey, previousValue), auditSnapshot(key, cleanValue)));
        entity.setUpdateTime(LocalDateTime.now());
        updateTenantScoped(entity, tenantId);
        return toDTO(entity);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id, SystemConfigOperationDTO request, Long currentUserId) {
        String tenantId = TenantContext.requireTenantId();
        validateOperationRequest(request, currentUserId, true);
        SystemConfig entity = getRequired(tenantId, id);
        if (!GROUP_SYSTEM.equals(entity.getConfigGroup())) {
            throw new BusinessException("仅允许删除 SYSTEM 分组基础参数");
        }
        entity.setRemoved(1);
        entity.setLastOperatorId(currentUserId);
        entity.setLastOperation(OPERATION_DELETE);
        entity.setLastOperationReason(cleanAuditText(request.getReason(), "删除系统基础参数"));
        entity.setAuditEvidenceSummary(buildAuditEvidenceSummary(request.getAuditEvidence(),
                auditSnapshot(entity.getConfigKey(), entity.getConfigValue()),
                auditSnapshot(entity.getConfigKey(), "<removed>")));
        entity.setUpdateTime(LocalDateTime.now());
        updateTenantScoped(entity, tenantId);
    }

    public SystemConfigPreviewDTO preview(String configGroup, SystemConfigSaveDTO request) {
        String tenantId = TenantContext.requireTenantId();
        String group = normalizeWritableGroup(configGroup);
        return buildPreview(tenantId, group, request);
    }

    public SystemConfigPreviewDTO previewSecurity(SystemConfigSaveDTO request) {
        String tenantId = TenantContext.requireTenantId();
        return buildPreview(tenantId, GROUP_SECURITY, request);
    }

    private SystemConfigPreviewDTO buildPreview(String tenantId, String group, SystemConfigSaveDTO request) {
        Map<String, String> proposed = extractChanges(request);
        Map<String, SystemConfig> currentByKey = safeList(systemConfigMapper.selectList(baseWrapper(tenantId, group))).stream()
                .collect(LinkedHashMap::new, (target, item) -> target.put(item.getConfigKey(), item), LinkedHashMap::putAll);
        List<String> changedKeys = new ArrayList<>();
        Map<String, String> before = new LinkedHashMap<>();
        Map<String, String> after = new LinkedHashMap<>();
        List<String> validationErrors = new ArrayList<>();

        String type = request == null ? "STRING" : normalizeType(request.getConfigType());
        for (Map.Entry<String, String> entry : proposed.entrySet()) {
            String key;
            try {
                key = normalizeKey(entry.getKey());
                validateConfigValue(group, key, entry.getValue(), type);
            } catch (BusinessException e) {
                validationErrors.add("参数校验失败，敏感或非法内容已隐藏");
                continue;
            }
            SystemConfig existing = currentByKey.get(key);
            String oldValue = existing == null ? null : existing.getConfigValue();
            String newValue = cleanValue(entry.getValue());
            if (!String.valueOf(oldValue).equals(String.valueOf(newValue))) {
                String safeKey = maskKeyIfSensitive(key);
                changedKeys.add(safeKey);
                before.put(safeKey, maskValue(key, oldValue));
                after.put(safeKey, maskValue(key, newValue));
            }
        }

        SystemConfigPreviewDTO preview = new SystemConfigPreviewDTO();
        preview.setConfigGroup(group);
        preview.setChangedKeys(changedKeys);
        preview.setBeforeMasked(before);
        preview.setAfterMasked(after);
        preview.setImpactModules(GROUP_SECURITY.equals(group) ? SECURITY_IMPACT_MODULES : SYSTEM_IMPACT_MODULES);
        preview.setRiskLevel(changedKeys.size() > 3 ? RISK_MEDIUM : RISK_LOW);
        preview.setValidationErrors(validationErrors);
        preview.setPersistent(false);
        preview.setCacheRefreshed(false);
        preview.setRuntimeEffect(false);
        preview.setSummary(validationErrors.isEmpty()
                ? previewSummary(group)
                : "影响预演发现校验问题，未写库、未刷新缓存、runtimeEffect=false");
        return preview;
    }

    private String previewSummary(String group) {
        if (GROUP_SECURITY.equals(group)) {
            return "安全策略配置态预览完成，persistent=false、cacheRefreshed=false、runtimeEffect=false；未写库、未刷新缓存、未改变登录、会话或移动端运行状态";
        }
        return "影响预演完成，未写库、未刷新缓存、runtimeEffect=false、未改变业务状态";
    }

    public SystemConfigRefreshResultDTO refreshCache(SystemConfigOperationDTO request, Long currentUserId) {
        String tenantId = TenantContext.requireTenantId();
        validateOperationRequest(request, currentUserId, true);
        long itemCount = safeList(systemConfigMapper.selectList(baseWrapper(tenantId, GROUP_SYSTEM))).size();
        List<String> namespaces = normalizeRefreshNamespaces(request.getNamespaces());
        Map<String, String> beforeMasked = namespaces.stream()
                .collect(LinkedHashMap::new, (target, namespace) -> target.put(namespace, "items=" + itemCount), LinkedHashMap::putAll);
        Map<String, String> afterMasked = namespaces.stream()
                .collect(LinkedHashMap::new, (target, namespace) -> target.put(namespace, "status=" + DEGRADED + "; mutation=none"), LinkedHashMap::putAll);
        List<SystemConfigRefreshResultDTO.NamespaceResult> namespaceResults = namespaces.stream()
                .map(namespace -> degradedNamespace(namespace, (int) itemCount))
                .toList();
        SystemConfigRefreshResultDTO result = new SystemConfigRefreshResultDTO();
        result.setOverallStatus(DEGRADED);
        result.setNamespaceResults(namespaceResults);
        result.setRefreshedCount(0);
        result.setDegradedCount(namespaceResults.size());
        result.setBeforeMasked(beforeMasked);
        result.setAfterMasked(afterMasked);
        result.setAuditEvidenceSummary(buildAuditEvidenceSummary(request.getAuditEvidence(), beforeMasked,
                afterMasked));
        result.setMessage("当前环境未接入可刷新系统参数缓存，已返回明确降级结果，未改变业务状态");
        return result;
    }

    private void upsertConfig(String tenantId, String group, String rawKey, String rawValue, SystemConfigSaveDTO request, Long currentUserId) {
        String key = normalizeKey(rawKey);
        String type = normalizeType(request.getConfigType());
        String cleanValue = cleanValue(rawValue);
        validateConfigValue(group, key, cleanValue, type);
        SystemConfig existing = systemConfigMapper.selectOne(baseWrapper(tenantId, group)
                .eq("config_key", key)
                .last("limit 1"));
        if (existing == null) {
            LocalDateTime now = LocalDateTime.now();
            SystemConfig created = new SystemConfig();
            created.setTenantId(tenantId);
            created.setConfigGroup(group);
            created.setConfigKey(key);
            created.setConfigValue(cleanValue);
            created.setConfigName(key);
            created.setConfigType(type);
            created.setStatus(0);
            created.setSensitiveMasked(isSensitiveKey(key));
            created.setLastOperatorId(currentUserId);
            created.setLastOperation(OPERATION_CREATE);
            created.setLastOperationReason(cleanAuditText(request.getReason(), "保存系统基础参数"));
            created.setAuditEvidenceSummary(buildAuditEvidenceSummary(request.getAuditEvidence(),
                    auditSnapshot(key, null), auditSnapshot(key, cleanValue)));
            created.setRemoved(0);
            created.setCreateTime(now);
            created.setUpdateTime(now);
            systemConfigMapper.insert(created);
            return;
        }
        Map<String, String> beforeMasked = auditSnapshot(existing.getConfigKey(), existing.getConfigValue());
        existing.setConfigValue(cleanValue);
        existing.setConfigType(type);
        existing.setSensitiveMasked(isSensitiveKey(key));
        existing.setLastOperatorId(currentUserId);
        existing.setLastOperation(OPERATION_UPDATE);
        existing.setLastOperationReason(cleanAuditText(request.getReason(), "保存系统基础参数"));
        existing.setAuditEvidenceSummary(buildAuditEvidenceSummary(request.getAuditEvidence(),
                beforeMasked, auditSnapshot(key, cleanValue)));
        existing.setUpdateTime(LocalDateTime.now());
        updateTenantScoped(existing, tenantId);
    }

    private String buildAuditEvidenceSummary(String auditEvidence, Map<String, String> beforeMasked, Map<String, String> afterMasked) {
        String evidenceState = hasText(auditEvidence) ? "provided" : "not-provided";
        return cleanAuditText("auditEvidence=" + evidenceState
                + "; beforeMasked=" + formatMaskedSummary(beforeMasked)
                + "; afterMasked=" + formatMaskedSummary(afterMasked), null);
    }

    private List<String> normalizeRefreshNamespaces(List<String> requestedNamespaces) {
        if (requestedNamespaces == null || requestedNamespaces.isEmpty()) {
            return List.of("system-config:SYSTEM");
        }
        List<String> namespaces = requestedNamespaces.stream()
                .filter(this::hasText)
                .map(String::trim)
                .filter(ALLOWED_REFRESH_NAMESPACES::contains)
                .distinct()
                .sorted(Comparator.naturalOrder())
                .toList();
        return namespaces.isEmpty() ? List.of("system-config:SYSTEM") : namespaces;
    }

    private Map<String, String> auditSnapshot(String key, String value) {
        Map<String, String> snapshot = new LinkedHashMap<>();
        String safeKey = maskKeyIfSensitive(key);
        String safeValue = value == null ? "<empty>" : maskValue(key, value);
        snapshot.put(safeKey, safeValue);
        return snapshot;
    }

    private String maskKeyIfSensitive(String key) {
        return isSensitiveKey(key) ? "masked-key" : key;
    }

    private String formatMaskedSummary(Map<String, String> summary) {
        if (summary == null || summary.isEmpty()) {
            return "{}";
        }
        StringBuilder builder = new StringBuilder("{");
        int count = 0;
        for (Map.Entry<String, String> entry : summary.entrySet()) {
            if (count > 0) {
                builder.append(", ");
            }
            if (count >= 6) {
                builder.append("...");
                break;
            }
            builder.append(entry.getKey()).append("=").append(limitAuditValue(entry.getValue()));
            count++;
        }
        builder.append("}");
        return builder.toString();
    }

    private String limitAuditValue(String value) {
        String safe = value == null ? "" : value;
        if (containsSensitiveAssignment(safe)) {
            safe = "******";
        }
        return safe.substring(0, Math.min(safe.length(), 64));
    }

    private QueryWrapper<SystemConfig> baseWrapper(String tenantId, String group) {
        return new QueryWrapper<SystemConfig>()
                .eq("tenant_id", tenantId)
                .eq("config_group", group)
                .eq("removed", 0);
    }

    private void updateTenantScoped(SystemConfig entity, String tenantId) {
        systemConfigMapper.update(entity, new UpdateWrapper<SystemConfig>()
                .eq("id", entity.getId())
                .eq("tenant_id", tenantId)
                .eq("removed", 0));
    }

    private SystemConfig getRequired(String tenantId, Long id) {
        if (id == null) {
            throw new BusinessException("系统参数不存在");
        }
        SystemConfig entity = systemConfigMapper.selectOne(new QueryWrapper<SystemConfig>()
                .eq("id", id)
                .eq("tenant_id", tenantId)
                .eq("removed", 0)
                .last("limit 1"));
        if (entity == null) {
            throw new BusinessException("系统参数不存在");
        }
        return entity;
    }

    private void ensureKeyAvailable(String tenantId, String group, String key, Long currentId) {
        SystemConfig existing = systemConfigMapper.selectOne(baseWrapper(tenantId, group)
                .eq("config_key", key)
                .last("limit 1"));
        if (existing != null && (currentId == null || !currentId.equals(existing.getId()))) {
            throw new BusinessException("系统参数键已存在");
        }
    }

    private Map<String, String> extractChanges(SystemConfigSaveDTO request) {
        if (request == null) {
            return Map.of();
        }
        if (request.getConfigs() != null && !request.getConfigs().isEmpty()) {
            return request.getConfigs().entrySet().stream()
                    .filter(entry -> hasText(entry.getKey()))
                    .collect(LinkedHashMap::new,
                            (target, entry) -> target.put(entry.getKey().trim(), cleanValue(entry.getValue())),
                            LinkedHashMap::putAll);
        }
        if (hasText(request.getConfigKey())) {
            Map<String, String> result = new LinkedHashMap<>();
            result.put(request.getConfigKey().trim(), cleanValue(request.getConfigValue()));
            return result;
        }
        return Map.of();
    }

    private void validateOperationRequest(SystemConfigSaveDTO request, Long currentUserId) {
        if (request == null) {
            throw new BusinessException("系统参数操作不能为空");
        }
        validateOperator(request.getOperatorId(), currentUserId);
        if (!hasText(request.getReason()) && !hasText(request.getAuditEvidence())) {
            throw new BusinessException("系统参数操作必须提供原因或审计证据");
        }
    }

    private void validateOperationRequest(SystemConfigOperationDTO request, Long currentUserId, boolean requireConfirmed) {
        if (request == null) {
            throw new BusinessException("系统参数操作不能为空");
        }
        if (requireConfirmed && !Boolean.TRUE.equals(request.getConfirmed())) {
            throw new BusinessException("系统参数操作必须确认");
        }
        validateOperator(request.getOperatorId(), currentUserId);
        if (!hasText(request.getReason()) && !hasText(request.getAuditEvidence())) {
            throw new BusinessException("系统参数操作必须提供原因或审计证据");
        }
    }

    private void validateOperator(Long operatorId, Long currentUserId) {
        if (operatorId == null || operatorId <= 0) {
            throw new BusinessException("系统参数操作人不能为空");
        }
        if (currentUserId == null || !operatorId.equals(currentUserId)) {
            throw new BusinessException("系统参数操作人不匹配");
        }
    }

    private void validateConfigValue(String group, String key, String value, String type) {
        if (GROUP_SYSTEM.equals(group) && isSensitiveKey(key)) {
            throw new BusinessException("SYSTEM 基础参数不允许使用敏感键");
        }
        String clean = cleanValue(value);
        if (clean.length() > 512) {
            throw new BusinessException("系统参数值过长");
        }
        if (containsSensitiveAssignment(clean)) {
            throw new BusinessException("系统参数值包含敏感明文，已拒绝");
        }
        if ("NUMBER".equals(type)) {
            try {
                double parsed = Double.parseDouble(clean);
                if (parsed < -1_000_000 || parsed > 1_000_000) {
                    throw new BusinessException("系统参数数值超出范围");
                }
            } catch (NumberFormatException e) {
                throw new BusinessException("系统参数数值格式不合法");
            }
        }
        if ("BOOLEAN".equals(type) && !Set.of("true", "false").contains(clean.toLowerCase(Locale.ROOT))) {
            throw new BusinessException("系统参数布尔值格式不合法");
        }
        if ("JSON".equals(type) && !(clean.startsWith("{") || clean.startsWith("["))) {
            throw new BusinessException("系统参数 JSON 格式不合法");
        }
    }

    private String normalizeGroup(String configGroup) {
        String group = hasText(configGroup) ? configGroup.trim().toUpperCase(Locale.ROOT) : GROUP_SYSTEM;
        if (!ALLOWED_GROUPS.contains(group)) {
            throw new BusinessException("系统参数分组不受支持");
        }
        return group;
    }

    private String normalizeListGroup(String configGroup) {
        return normalizeGroup(hasText(configGroup) ? configGroup : GROUP_SYSTEM);
    }

    private String normalizeWritableGroup(String configGroup) {
        String group = normalizeGroup(configGroup);
        if (!GROUP_SYSTEM.equals(group)) {
            throw new BusinessException("本批仅允许 SYSTEM 分组基础参数写入");
        }
        return group;
    }

    private String normalizeKey(String configKey) {
        if (!hasText(configKey)) {
            throw new BusinessException("系统参数键不能为空");
        }
        String normalized = configKey.trim();
        if (!normalized.matches("[A-Za-z][A-Za-z0-9._-]{1,96}")) {
            throw new BusinessException("系统参数键格式不合法");
        }
        return normalized;
    }

    private String normalizeType(String configType) {
        String type = hasText(configType) ? configType.trim().toUpperCase(Locale.ROOT) : "STRING";
        if (!ALLOWED_TYPES.contains(type)) {
            throw new BusinessException("系统参数类型不受支持");
        }
        return type;
    }

    private String cleanValue(String value) {
        return value == null ? "" : value.trim();
    }

    private String cleanName(String value, String fallback) {
        String source = hasText(value) ? value.trim() : fallback;
        return source.substring(0, Math.min(source.length(), 128));
    }

    private String cleanAuditText(String value, String fallback) {
        String source = hasText(value) ? value.trim() : fallback;
        if (!hasText(source)) {
            return null;
        }
        String cleaned = source.replaceAll("[\\r\\n]", " ")
                .replaceAll("(?i)(secret|token|password|clientSecret|privateKey|apiKey|bearerToken|signingKey|cert)\\s*[:=]\\s*[^\\s,;]+", "$1=******");
        return cleaned.substring(0, Math.min(cleaned.length(), 240));
    }

    private boolean containsSensitiveAssignment(String value) {
        if (!hasText(value)) {
            return false;
        }
        return value.matches("(?i).*\\b(secret|token|password|clientSecret|privateKey|apiKey|bearerToken|signingKey|cert)\\s*[:=].*");
    }

    private boolean isSensitiveKey(String key) {
        String normalized = key == null ? "" : key.replace("_", "").replace("-", "").toLowerCase(Locale.ROOT);
        return SENSITIVE_KEYS.stream().anyMatch(normalized::contains);
    }

    private String maskIfSensitive(SystemConfig config) {
        return maskValue(config.getConfigKey(), config.getConfigValue());
    }

    private String maskValue(String key, String value) {
        if (value == null) {
            return "";
        }
        if (isSensitiveKey(key) || containsSensitiveAssignment(value)) {
            return "******";
        }
        return value;
    }

    private SystemConfigDTO toDTO(SystemConfig source) {
        SystemConfigDTO target = new SystemConfigDTO();
        target.setId(source.getId());
        target.setTenantId(source.getTenantId());
        target.setConfigGroup(source.getConfigGroup());
        target.setConfigKey(source.getConfigKey());
        target.setConfigValue(maskIfSensitive(source));
        target.setDisplayValue(maskIfSensitive(source));
        target.setConfigName(source.getConfigName());
        target.setConfigType(source.getConfigType());
        target.setStatus(source.getStatus());
        target.setRemark(source.getRemark());
        target.setSensitiveMasked(Boolean.TRUE.equals(source.getSensitiveMasked()) || isSensitiveKey(source.getConfigKey()));
        target.setLastOperatorId(source.getLastOperatorId());
        target.setLastOperation(source.getLastOperation());
        target.setLastOperationReason(source.getLastOperationReason());
        target.setAuditEvidenceSummary(source.getAuditEvidenceSummary());
        target.setCreateTime(source.getCreateTime());
        target.setUpdateTime(source.getUpdateTime());
        return target;
    }

    private SystemConfigRefreshResultDTO.NamespaceResult degradedNamespace(String namespace, Integer itemCount) {
        SystemConfigRefreshResultDTO.NamespaceResult result = new SystemConfigRefreshResultDTO.NamespaceResult();
        result.setNamespace(namespace);
        result.setStatus(DEGRADED);
        result.setItemCount(itemCount);
        result.setMessage("未发现真实缓存管理器，未执行刷新，返回明确降级结果");
        result.setRemediation("接入缓存管理器后返回 REFRESHED/SKIPPED 明细；当前结果不得视为空成功");
        return result;
    }

    private List<SystemConfig> safeList(List<SystemConfig> records) {
        return records == null ? List.of() : records;
    }

    private int clamp(Integer value, int min, int max, int fallback) {
        if (value == null) {
            return fallback;
        }
        return Math.max(min, Math.min(max, value));
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
