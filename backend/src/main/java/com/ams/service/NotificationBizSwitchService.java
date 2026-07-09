package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.dto.NotificationBizSwitchDTO;
import com.ams.dto.NotificationBizSwitchMetaDTO;
import com.ams.dto.NotificationBizSwitchPreviewRequestDTO;
import com.ams.dto.NotificationBizSwitchPreviewRespDTO;
import com.ams.entity.NotificationBizSwitch;
import com.ams.mapper.NotificationBizSwitchMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class NotificationBizSwitchService {

    private static final int MAX_META_LIMIT = 100;
    private static final String READONLY_BOUNDARY = "read-only notification switch catalog + no-persistence preview + no-send preview；workflowRuntimeEffect=false；不写库、不发送通知、不改变流程运行时。";
    private static final Pattern TOKEN_PATTERN = Pattern.compile("[A-Za-z0-9_-]{1,64}");
    private static final Pattern CHANNEL_PATTERN = Pattern.compile("[A-Z][A-Z0-9_-]{0,63}");
    private static final Set<String> OVERRIDE_INPUTS = Set.of(
            "tenantid", "userid", "workflowdefinition", "workflowdefinitionid",
            "processinstance", "processinstanceid", "runtime", "runtimecontext"
    );
    private static final Map<String, String> DEFAULT_BIZ_TYPE_LABELS = defaultBizTypeLabels();
    private static final Map<String, String> DEFAULT_EVENT_LABELS = defaultEventLabels();
    private static final Map<String, String> DEFAULT_CHANNEL_LABELS = defaultChannelLabels();

    private final NotificationBizSwitchMapper notificationBizSwitchMapper;

    public List<NotificationBizSwitchDTO> list() {
        String tenantId = TenantContext.requireTenantId();
        return notificationBizSwitchMapper.selectAllByTenant(tenantId).stream().map(this::toDTO).toList();
    }

    public List<NotificationBizSwitchDTO> getByBizType(String bizType) {
        String tenantId = TenantContext.requireTenantId();
        String normalizedBizType = normalizeBizType(bizType);
        if (normalizedBizType == null) {
            return List.of();
        }
        return notificationBizSwitchMapper.selectByBizTypeAndTenant(tenantId, normalizedBizType).stream().map(this::toDTO).toList();
    }

    public NotificationBizSwitchMetaDTO meta() {
        String tenantId = TenantContext.requireTenantId();
        return NotificationBizSwitchMetaDTO.builder()
                .bizTypes(mergeOptions(notificationBizSwitchMapper.listBizTypes(tenantId, MAX_META_LIMIT), DEFAULT_BIZ_TYPE_LABELS))
                .events(mergeOptions(notificationBizSwitchMapper.listEvents(tenantId, MAX_META_LIMIT), DEFAULT_EVENT_LABELS))
                .channelTypes(mergeChannelOptions(notificationBizSwitchMapper.listChannelTypes(tenantId, MAX_META_LIMIT)))
                .statuses(List.of(option("1", "允许通知"), option("0", "阻断通知")))
                .previewPolicy(NotificationBizSwitchMetaDTO.PreviewPolicy.builder()
                        .tenantScoped(true)
                        .noPersistence(true)
                        .noSend(true)
                        .workflowRuntimeEffect(false)
                        .rejectedInputFields(new ArrayList<>(OVERRIDE_INPUTS))
                        .readonlyBoundary(READONLY_BOUNDARY)
                        .build())
                .tenantScoped(true)
                .readOnly(true)
                .noPersistencePreview(true)
                .noSend(true)
                .workflowRuntimeEffect(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .nonGoals(List.of("不启停开关", "不发送通知", "不接入流程运行时", "不写消息中心或发送队列", "不扩展模板、偏好、渠道或邮件网关"))
                .build();
    }

    public NotificationBizSwitchPreviewRespDTO preview(NotificationBizSwitchPreviewRequestDTO request) {
        String tenantId = TenantContext.requireTenantId();
        NotificationBizSwitchPreviewRequestDTO source = request == null ? new NotificationBizSwitchPreviewRequestDTO() : request;
        List<NotificationBizSwitchPreviewRespDTO.RejectedInput> rejectedInputs = new ArrayList<>();
        collectUnknownInputs(source, rejectedInputs);

        String bizType = normalizeRequiredToken(source.getBizType(), "bizType", rejectedInputs);
        String event = normalizeRequiredToken(source.getEvent(), "event", rejectedInputs);
        String channelType = normalizeChannelType(source.getChannelType(), rejectedInputs);
        boolean sampleEnabled = normalizeEnabled(source.getEnabled(), rejectedInputs);

        List<NotificationBizSwitchDTO> matchedSwitches = bizType == null || event == null
                ? List.of()
                : notificationBizSwitchMapper.selectForPreview(tenantId, bizType, event, channelType).stream().map(this::toDTO).toList();
        List<String> missingSwitches = collectMissingSwitches(bizType, event, channelType, matchedSwitches);
        boolean blockedBySwitch = !sampleEnabled || matchedSwitches.stream().anyMatch(item -> Integer.valueOf(0).equals(item.getEnabled()));
        boolean wouldNotify = rejectedInputs.isEmpty() && missingSwitches.isEmpty() && !blockedBySwitch;

        return NotificationBizSwitchPreviewRespDTO.builder()
                .wouldNotify(wouldNotify)
                .blockedBySwitch(blockedBySwitch)
                .matchedSwitches(matchedSwitches)
                .missingSwitches(missingSwitches)
                .rejectedInputs(rejectedInputs)
                .tenantScoped(true)
                .noPersistence(true)
                .noSend(true)
                .workflowRuntimeEffect(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    private NotificationBizSwitchDTO toDTO(NotificationBizSwitch switchConfig) {
        return NotificationBizSwitchDTO.builder()
                .id(switchConfig.getId())
                .tenantId(switchConfig.getTenantId())
                .bizType(switchConfig.getBizType())
                .event(switchConfig.getEvent())
                .channelType(switchConfig.getChannelType())
                .enabled(switchConfig.getEnabled())
                .templateCode(switchConfig.getTemplateCode())
                .description(switchConfig.getDescription())
                .tenantScoped(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .createTime(switchConfig.getCreateTime())
                .updateTime(switchConfig.getUpdateTime())
                .build();
    }

    private void collectUnknownInputs(NotificationBizSwitchPreviewRequestDTO source,
                                      List<NotificationBizSwitchPreviewRespDTO.RejectedInput> rejectedInputs) {
        Map<String, Object> unknownInputs = source.getUnknownInputs();
        if (unknownInputs == null || unknownInputs.isEmpty()) {
            return;
        }
        for (String field : unknownInputs.keySet()) {
            String normalized = field == null ? "" : field.trim();
            String lowered = normalized.replaceAll("[_\\-.]", "").toLowerCase(Locale.ROOT);
            if (OVERRIDE_INPUTS.contains(lowered)) {
                rejectedInputs.add(rejected(normalized, "租户、用户或流程运行时覆盖输入已拒绝；租户仅来自 TenantContext"));
            } else {
                rejectedInputs.add(rejected(normalized, "预览只接受 bizType、event、channelType、enabled"));
            }
        }
    }

    private String normalizeRequiredToken(String rawValue, String field, List<NotificationBizSwitchPreviewRespDTO.RejectedInput> rejectedInputs) {
        String normalized = normalizeBizType(rawValue);
        if (normalized == null) {
            rejectedInputs.add(rejected(field, "字段为空或格式非法"));
        }
        return normalized;
    }

    private String normalizeBizType(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        String value = rawValue.trim().toLowerCase(Locale.ROOT);
        return TOKEN_PATTERN.matcher(value).matches() ? value : null;
    }

    private String normalizeChannelType(String rawValue, List<NotificationBizSwitchPreviewRespDTO.RejectedInput> rejectedInputs) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        String value = rawValue.trim().toUpperCase(Locale.ROOT);
        if (!CHANNEL_PATTERN.matcher(value).matches()) {
            rejectedInputs.add(rejected("channelType", "渠道类型格式非法"));
            return null;
        }
        return value;
    }

    private boolean normalizeEnabled(Integer rawValue, List<NotificationBizSwitchPreviewRespDTO.RejectedInput> rejectedInputs) {
        if (rawValue == null) {
            return true;
        }
        if (rawValue == 0 || rawValue == 1) {
            return rawValue == 1;
        }
        rejectedInputs.add(rejected("enabled", "启停样例只允许 0 或 1"));
        return false;
    }

    private List<String> collectMissingSwitches(String bizType, String event, String channelType, List<NotificationBizSwitchDTO> matchedSwitches) {
        List<String> missing = new ArrayList<>();
        if (bizType == null) {
            missing.add("bizType");
        }
        if (event == null) {
            missing.add("event");
        }
        if (bizType != null && event != null && matchedSwitches.isEmpty()) {
            missing.add(bizType + ":" + event + ":" + (channelType == null ? "ALL" : channelType));
        }
        return missing;
    }

    private List<NotificationBizSwitchMetaDTO.Option> mergeOptions(List<String> observed, Map<String, String> defaults) {
        LinkedHashMap<String, String> values = new LinkedHashMap<>(defaults);
        if (observed != null) {
            observed.stream()
                    .map(this::normalizeBizType)
                    .filter(item -> item != null)
                    .forEach(item -> values.putIfAbsent(item, item));
        }
        return values.entrySet().stream().map(entry -> option(entry.getKey(), entry.getValue())).toList();
    }

    private List<NotificationBizSwitchMetaDTO.Option> mergeChannelOptions(List<String> observed) {
        LinkedHashSet<String> values = new LinkedHashSet<>(DEFAULT_CHANNEL_LABELS.keySet());
        if (observed != null) {
            observed.stream()
                    .map(value -> normalizeChannelType(value, new ArrayList<>()))
                    .filter(item -> item != null)
                    .forEach(values::add);
        }
        return values.stream().map(value -> option(value, DEFAULT_CHANNEL_LABELS.getOrDefault(value, value))).toList();
    }

    private NotificationBizSwitchMetaDTO.Option option(String value, String label) {
        return NotificationBizSwitchMetaDTO.Option.builder().value(value).label(label).build();
    }

    private NotificationBizSwitchPreviewRespDTO.RejectedInput rejected(String field, String reason) {
        return NotificationBizSwitchPreviewRespDTO.RejectedInput.builder()
                .field(field == null ? "" : field)
                .reason(reason)
                .build();
    }

    private static Map<String, String> defaultBizTypeLabels() {
        LinkedHashMap<String, String> labels = new LinkedHashMap<>();
        labels.put("retirement", "退休/报废");
        labels.put("maintenance", "维保");
        labels.put("approval", "审批");
        labels.put("system", "系统");
        return labels;
    }

    private static Map<String, String> defaultEventLabels() {
        LinkedHashMap<String, String> labels = new LinkedHashMap<>();
        labels.put("created", "创建");
        labels.put("submitted", "提交");
        labels.put("approved", "通过");
        labels.put("rejected", "驳回");
        labels.put("reminder", "提醒");
        return labels;
    }

    private static Map<String, String> defaultChannelLabels() {
        LinkedHashMap<String, String> labels = new LinkedHashMap<>();
        labels.put("ALL", "全部渠道");
        labels.put("IN_APP", "站内信");
        labels.put("EMAIL", "邮件");
        return labels;
    }
}
