package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.NotificationPreferenceDTO;
import com.ams.dto.NotificationPreferenceMetaDTO;
import com.ams.dto.NotificationPreferencePreviewRequestDTO;
import com.ams.dto.NotificationPreferencePreviewRespDTO;
import com.ams.entity.NotificationPreference;
import com.ams.mapper.NotificationPreferenceMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
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
public class NotificationPreferenceService {

    private static final int MAX_META_LIMIT = 100;
    private static final String READONLY_BOUNDARY = "只读通知偏好目录与无持久化预览；不保存偏好、不发送通知、不改变运行时发送决策。";
    private static final Pattern CATEGORY_PATTERN = Pattern.compile("[A-Za-z][A-Za-z0-9_-]{0,63}");
    private static final Set<String> RESERVED_CATEGORY_WORDS = Set.of("meta", "preview", "batch", "user", "users", "id");
    private static final List<String> DEFAULT_CATEGORY_ORDER = List.of("retirement", "maintenance", "approval", "system", "general");
    private static final Map<String, String> DEFAULT_CATEGORY_LABELS = Map.of(
            "retirement", "退休/报废",
            "maintenance", "维保",
            "approval", "审批",
            "system", "系统",
            "general", "通用"
    );
    private static final Set<String> ALLOWED_CHANNEL_TYPES = Set.of("ALL", "IN_APP", "EMAIL");

    private final NotificationPreferenceMapper notificationPreferenceMapper;

    public List<NotificationPreferenceDTO> list() {
        String tenantId = TenantContext.requireTenantId();
        List<NotificationPreference> records = notificationPreferenceMapper.selectAllActive(tenantId);
        LinkedHashMap<String, NotificationPreference> byCategory = new LinkedHashMap<>();
        for (NotificationPreference preference : records) {
            String category = normalizeCategory(preference.getCategory());
            if (category != null) {
                byCategory.putIfAbsent(category, preference);
            }
        }

        List<NotificationPreferenceDTO> result = new ArrayList<>();
        for (String category : DEFAULT_CATEGORY_ORDER) {
            NotificationPreference preference = byCategory.remove(category);
            result.add(toDTO(preference == null ? defaultPreference(tenantId, category) : preference, preference == null));
        }
        for (Map.Entry<String, NotificationPreference> entry : byCategory.entrySet()) {
            result.add(toDTO(entry.getValue(), false));
        }
        return result;
    }

    public NotificationPreferenceDTO getByCategory(String rawCategory) {
        String tenantId = TenantContext.requireTenantId();
        String category = requireKnownCategory(tenantId, rawCategory);
        NotificationPreference preference = notificationPreferenceMapper.selectByCategoryAndTenant(tenantId, category);
        return toDTO(preference == null ? defaultPreference(tenantId, category) : preference, preference == null);
    }

    public NotificationPreferenceMetaDTO meta() {
        String tenantId = TenantContext.requireTenantId();
        return NotificationPreferenceMetaDTO.builder()
                .categories(mergeCategoryOptions(notificationPreferenceMapper.listCategories(tenantId, MAX_META_LIMIT)))
                .channelTypes(List.of(
                        option("ALL", "全部渠道"),
                        option("IN_APP", "站内信"),
                        option("EMAIL", "邮件")
                ))
                .statuses(List.of(option("1", "启用"), option("0", "停用")))
                .quietWindowPolicy(NotificationPreferenceMetaDTO.QuietWindowPolicy.builder()
                        .format("HH:mm")
                        .crossMidnightSupported(true)
                        .examples(List.of("22:00-07:30", "12:00-13:00"))
                        .build())
                .previewPolicy(NotificationPreferenceMetaDTO.PreviewPolicy.builder()
                        .tenantScoped(true)
                        .noPersistence(true)
                        .noSend(true)
                        .runtimeEffect(false)
                        .rejectedInputFields(List.of("userId", "tenantId", "templateId", "switchId", "channelCredential", "sendTarget"))
                        .build())
                .reservedCategoryWords(new ArrayList<>(RESERVED_CATEGORY_WORDS))
                .tenantScoped(true)
                .readOnly(true)
                .noPersistencePreview(true)
                .runtimeEffect(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .nonGoals(List.of("不保存偏好", "不批量保存偏好", "不管理 userId", "不发送通知", "不配置渠道", "不控制流程通知开关", "不接入邮件网关或消息中心"))
                .build();
    }

    public NotificationPreferencePreviewRespDTO preview(NotificationPreferencePreviewRequestDTO request) {
        String tenantId = TenantContext.requireTenantId();
        NotificationPreferencePreviewRequestDTO source = request == null ? new NotificationPreferencePreviewRequestDTO() : request;
        List<NotificationPreferencePreviewRespDTO.RejectedInput> rejectedInputs = new ArrayList<>();
        collectUnknownInputs(source, rejectedInputs);

        String category = normalizeCategory(source.getCategory());
        NotificationPreference preference = null;
        boolean missingPreference = false;
        if (category == null || !isKnownCategory(tenantId, category)) {
            rejectedInputs.add(rejected("category", "分类为空、保留字、数字 ID、slash-like 或不在当前租户只读目录中"));
        } else {
            preference = notificationPreferenceMapper.selectByCategoryAndTenant(tenantId, category);
            missingPreference = preference == null;
            if (preference == null) {
                preference = defaultPreference(tenantId, category);
            }
        }

        String channelType = normalizeChannel(source.getChannelType(), rejectedInputs);
        LocalTime sampleTime = parseTime(source.getSampleTime(), "sampleTime", rejectedInputs);
        LocalTime quietStart = parseTime(firstText(source.getQuietStart(), preference == null ? null : preference.getQuietStart()), "quietStart", rejectedInputs);
        LocalTime quietEnd = parseTime(firstText(source.getQuietEnd(), preference == null ? null : preference.getQuietEnd()), "quietEnd", rejectedInputs);
        boolean quietWindowMatched = sampleTime != null && quietStart != null && quietEnd != null && inQuietWindow(sampleTime, quietStart, quietEnd);
        boolean inAppEnabled = preference != null && Integer.valueOf(1).equals(preference.getInApp());
        boolean emailEnabled = preference != null && Integer.valueOf(1).equals(preference.getEmail());
        boolean selectedChannelEnabled = switch (channelType) {
            case "IN_APP" -> inAppEnabled;
            case "EMAIL" -> emailEnabled;
            default -> inAppEnabled || emailEnabled;
        };

        return NotificationPreferencePreviewRespDTO.builder()
                .wouldReceive(rejectedInputs.isEmpty() && selectedChannelEnabled && !quietWindowMatched)
                .inAppEnabled(inAppEnabled)
                .emailEnabled(emailEnabled)
                .quietWindowMatched(quietWindowMatched)
                .missingPreferences(missingPreference && category != null ? List.of(category) : List.of())
                .rejectedInputs(rejectedInputs)
                .tenantScoped(true)
                .noPersistence(true)
                .runtimeEffect(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    private void collectUnknownInputs(NotificationPreferencePreviewRequestDTO source, List<NotificationPreferencePreviewRespDTO.RejectedInput> rejectedInputs) {
        Map<String, Object> unknownInputs = source.getUnknownInputs();
        if (unknownInputs == null || unknownInputs.isEmpty()) {
            return;
        }
        for (String field : unknownInputs.keySet()) {
            String normalized = field == null ? "" : field.trim();
            if (normalized.equalsIgnoreCase("userId") || normalized.equalsIgnoreCase("tenantId")) {
                rejectedInputs.add(rejected(normalized, "前端传入的用户或租户标识不作为通知偏好 authority"));
            } else {
                rejectedInputs.add(rejected(normalized, "预览只接受 category、channelType、sampleTime、quietStart、quietEnd"));
            }
        }
    }

    private String requireKnownCategory(String tenantId, String rawCategory) {
        String category = normalizeCategory(rawCategory);
        if (category == null || !isKnownCategory(tenantId, category)) {
            throw new BusinessException("通知偏好分类不在只读目录中");
        }
        return category;
    }

    private boolean isKnownCategory(String tenantId, String category) {
        if (category == null) {
            return false;
        }
        if (DEFAULT_CATEGORY_LABELS.containsKey(category)) {
            return true;
        }
        return notificationPreferenceMapper.listCategories(tenantId, MAX_META_LIMIT).stream()
                .map(this::normalizeCategory)
                .anyMatch(category::equals);
    }

    private String normalizeCategory(String rawCategory) {
        if (rawCategory == null || rawCategory.isBlank()) {
            return null;
        }
        String category = rawCategory.trim().toLowerCase(Locale.ROOT);
        if (category.contains("/") || category.contains("\\") || category.chars().allMatch(Character::isDigit)) {
            return null;
        }
        if (RESERVED_CATEGORY_WORDS.contains(category) || !CATEGORY_PATTERN.matcher(category).matches()) {
            return null;
        }
        return category;
    }

    private String normalizeChannel(String rawChannelType, List<NotificationPreferencePreviewRespDTO.RejectedInput> rejectedInputs) {
        if (rawChannelType == null || rawChannelType.isBlank()) {
            return "ALL";
        }
        String channelType = rawChannelType.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_CHANNEL_TYPES.contains(channelType)) {
            rejectedInputs.add(rejected("channelType", "渠道只允许 ALL、IN_APP 或 EMAIL"));
            return "ALL";
        }
        return channelType;
    }

    private LocalTime parseTime(String rawValue, String field, List<NotificationPreferencePreviewRespDTO.RejectedInput> rejectedInputs) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        String value = rawValue.trim();
        try {
            return LocalTime.parse(value, DateTimeFormatter.ofPattern("H:mm"));
        } catch (DateTimeParseException ignored) {
            try {
                return LocalDateTime.parse(value).toLocalTime();
            } catch (DateTimeParseException ex) {
                rejectedInputs.add(rejected(field, "时间格式必须是 HH:mm 或 ISO LocalDateTime"));
                return null;
            }
        }
    }

    private boolean inQuietWindow(LocalTime sampleTime, LocalTime start, LocalTime end) {
        if (start.equals(end)) {
            return true;
        }
        if (start.isBefore(end)) {
            return !sampleTime.isBefore(start) && sampleTime.isBefore(end);
        }
        return !sampleTime.isBefore(start) || sampleTime.isBefore(end);
    }

    private List<NotificationPreferenceMetaDTO.Option> mergeCategoryOptions(List<String> observed) {
        LinkedHashSet<String> categories = new LinkedHashSet<>(DEFAULT_CATEGORY_ORDER);
        if (observed != null) {
            observed.stream().map(this::normalizeCategory).filter(item -> item != null).forEach(categories::add);
        }
        return categories.stream()
                .map(category -> option(category, DEFAULT_CATEGORY_LABELS.getOrDefault(category, category)))
                .toList();
    }

    private NotificationPreferenceDTO toDTO(NotificationPreference preference, boolean missingPreference) {
        return NotificationPreferenceDTO.builder()
                .id(preference.getId())
                .tenantId(preference.getTenantId())
                .category(preference.getCategory())
                .categoryLabel(DEFAULT_CATEGORY_LABELS.getOrDefault(preference.getCategory(), preference.getCategory()))
                .inApp(preference.getInApp())
                .email(preference.getEmail())
                .quietStart(preference.getQuietStart())
                .quietEnd(preference.getQuietEnd())
                .status(preference.getStatus())
                .missingPreference(missingPreference)
                .tenantScoped(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .createTime(preference.getCreateTime())
                .updateTime(preference.getUpdateTime())
                .build();
    }

    private NotificationPreference defaultPreference(String tenantId, String category) {
        NotificationPreference preference = new NotificationPreference();
        preference.setTenantId(tenantId);
        preference.setCategory(category);
        preference.setInApp(1);
        preference.setEmail(0);
        preference.setStatus(1);
        return preference;
    }

    private NotificationPreferenceMetaDTO.Option option(String value, String label) {
        return NotificationPreferenceMetaDTO.Option.builder().value(value).label(label).build();
    }

    private NotificationPreferencePreviewRespDTO.RejectedInput rejected(String field, String reason) {
        return NotificationPreferencePreviewRespDTO.RejectedInput.builder()
                .field(field == null ? "" : field)
                .reason(reason)
                .build();
    }

    private String firstText(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        return second;
    }
}
