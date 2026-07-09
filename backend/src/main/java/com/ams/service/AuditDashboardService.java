package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.AuditDashboardQueryDTO;
import com.ams.dto.AuditDistResp;
import com.ams.dto.AuditLogDTO;
import com.ams.dto.AuditLogDetailDTO;
import com.ams.dto.AuditLogStatsDTO;
import com.ams.dto.AuditTrendResp;
import com.ams.dto.OperatorRankingVO;
import com.ams.entity.GeneralAuditEntry;
import com.ams.mapper.AuditLogMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuditDashboardService {

    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int DEFAULT_RANKING_LIMIT = 10;
    private static final int MAX_RANKING_LIMIT = 20;
    private static final int MAX_META_LIMIT = 100;
    private static final long MAX_RANGE_DAYS = 365;
    private static final String READONLY_BOUNDARY = "GET-only /audit-logs 只读查询；不采集审计写入、不生成真实导出文件、不代表全局审计闭环。";
    private static final Set<String> SENSITIVE_KEYS = Set.of(
            "secret", "token", "password", "privatekey", "clientsecret", "apikey",
            "authorization", "cookie", "credential", "accesskey", "refreshtoken"
    );
    private static final Pattern SENSITIVE_ASSIGNMENT = Pattern.compile(
            "(?i)(secret|token|password|privateKey|clientSecret|apiKey|authorization|cookie|credential|accessKey|refreshToken)\\s*[:=]\\s*[^\\s,;&]+"
    );

    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AuditLogDTO.PageResult list(AuditDashboardQueryDTO query) {
        String tenantId = TenantContext.requireTenantId();
        NormalizedQuery normalized = normalizeQuery(query, false);
        long total = auditLogMapper.countRecords(
                tenantId,
                normalized.startTime(),
                normalized.endTime(),
                normalized.operationType(),
                normalized.operatorId(),
                normalized.operatorName(),
                normalized.resourceType(),
                normalized.resourceId(),
                normalized.keyword()
        );
        List<AuditLogDTO> records = total == 0
                ? List.of()
                : auditLogMapper.selectPageRecords(
                        tenantId,
                        normalized.startTime(),
                        normalized.endTime(),
                        normalized.operationType(),
                        normalized.operatorId(),
                        normalized.operatorName(),
                        normalized.resourceType(),
                        normalized.resourceId(),
                        normalized.keyword(),
                        normalized.pageSize(),
                        normalized.offset()
                ).stream().map(this::toListDTO).toList();
        long pages = total == 0 ? 0 : (long) Math.ceil((double) total / normalized.pageSize());
        return AuditLogDTO.PageResult.builder()
                .records(records)
                .total(total)
                .size(normalized.pageSize())
                .current(normalized.page())
                .pages(pages)
                .tenantScoped(true)
                .masked(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    public AuditLogDetailDTO detail(Long id) {
        String tenantId = TenantContext.requireTenantId();
        if (id == null || id <= 0) {
            throw new BusinessException("审计日志不存在");
        }
        GeneralAuditEntry entry = auditLogMapper.selectDetail(tenantId, id);
        if (entry == null) {
            throw new BusinessException("审计日志不存在");
        }
        return toDetailDTO(entry);
    }

    public AuditLogStatsDTO stats(AuditDashboardQueryDTO query) {
        String tenantId = TenantContext.requireTenantId();
        NormalizedQuery normalized = normalizeQuery(query, true);
        long total = auditLogMapper.countRecords(
                tenantId,
                normalized.startTime(),
                normalized.endTime(),
                normalized.operationType(),
                normalized.operatorId(),
                normalized.operatorName(),
                normalized.resourceType(),
                normalized.resourceId(),
                normalized.keyword()
        );
        AuditTrendResp trend = trends(query);
        AuditDistResp distribution = actionTypeDistribution(query);
        List<OperatorRankingVO> ranking = operatorRanking(query);
        return AuditLogStatsDTO.builder()
                .totalCount(total)
                .trendData(trend.getData())
                .typeDistribution(distribution.getDistribution())
                .topOperators(ranking)
                .meta(meta())
                .tenantScoped(true)
                .masked(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    public AuditTrendResp trends(AuditDashboardQueryDTO query) {
        String tenantId = TenantContext.requireTenantId();
        NormalizedQuery normalized = normalizeQuery(query, true);
        List<AuditTrendResp.DataPoint> data = "hourly".equals(normalized.granularity())
                ? auditLogMapper.countByHour(tenantId, normalized.startTime(), normalized.endTime(), normalized.operationType())
                : auditLogMapper.countByDay(tenantId, normalized.startTime(), normalized.endTime(), normalized.operationType());
        return AuditTrendResp.builder()
                .granularity(normalized.granularity())
                .startDate(normalized.startTime().toLocalDate())
                .endDate(normalized.endTime().toLocalDate())
                .startTime(normalized.startTime())
                .endTime(normalized.endTime())
                .data(data == null ? new ArrayList<>() : data)
                .tenantScoped(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    public AuditDistResp actionTypeDistribution(AuditDashboardQueryDTO query) {
        String tenantId = TenantContext.requireTenantId();
        NormalizedQuery normalized = normalizeQuery(query, true);
        List<AuditDistResp.DistributionItem> rows = auditLogMapper.countByOperationType(tenantId, normalized.startTime(), normalized.endTime());
        long total = rows == null ? 0 : rows.stream().mapToLong(item -> item.getCount() == null ? 0L : item.getCount()).sum();
        List<AuditDistResp.DistributionItem> distribution = rows == null ? List.of() : rows.stream()
                .map(item -> AuditDistResp.DistributionItem.builder()
                        .actionType(item.getActionType())
                        .count(item.getCount())
                        .percentage(total == 0 ? 0D : Math.round((item.getCount() * 10000D / total)) / 100D)
                        .build())
                .toList();
        return AuditDistResp.builder()
                .totalOperations(total)
                .distribution(distribution)
                .tenantScoped(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    public List<OperatorRankingVO> operatorRanking(AuditDashboardQueryDTO query) {
        String tenantId = TenantContext.requireTenantId();
        NormalizedQuery normalized = normalizeQuery(query, true);
        int limit = normalizeLimit(query == null ? null : query.getLimit(), DEFAULT_RANKING_LIMIT, MAX_RANKING_LIMIT);
        List<OperatorRankingVO> rows = auditLogMapper.countByOperator(tenantId, normalized.startTime(), normalized.endTime(), limit);
        if (rows == null) {
            return List.of();
        }
        for (int index = 0; index < rows.size(); index++) {
            rows.get(index).setRank(index + 1);
        }
        return rows;
    }

    public Map<String, Object> meta() {
        String tenantId = TenantContext.requireTenantId();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("operationTypes", auditLogMapper.listOperationTypes(tenantId, MAX_META_LIMIT));
        result.put("resourceTypes", auditLogMapper.listResourceTypes(tenantId, MAX_META_LIMIT));
        result.put("operators", auditLogMapper.listOperators(tenantId, MAX_META_LIMIT));
        result.put("tenantScoped", true);
        result.put("masked", true);
        result.put("readonlyBoundary", READONLY_BOUNDARY);
        result.put("nonGoals", List.of("不采集审计写入", "不代表全模块审计覆盖", "不提供真实导出文件", "不对接 SIEM"));
        return result;
    }

    private AuditLogDTO toListDTO(GeneralAuditEntry entry) {
        AuditLogDTO dto = new AuditLogDTO();
        fillBase(dto, entry);
        return dto;
    }

    private AuditLogDetailDTO toDetailDTO(GeneralAuditEntry entry) {
        AuditLogDetailDTO dto = new AuditLogDetailDTO();
        fillBase(dto, entry);
        return dto;
    }

    private void fillBase(AuditLogDTO dto, GeneralAuditEntry entry) {
        dto.setId(entry.getId());
        dto.setTraceId(safeTrace(entry.getTraceId()));
        dto.setOperationType(firstText(entry.getOperationType(), entry.getAction(), "UNKNOWN"));
        dto.setOperatorId(entry.getOperatorId());
        dto.setOperatorName(firstText(entry.getOperatorName(), "未知用户"));
        dto.setResourceType(firstText(entry.getResourceType(), "UNKNOWN"));
        dto.setResourceId(maskResourceId(entry.getResourceId()));
        dto.setDescription(cleanText(entry.getDescription(), 160));
        dto.setHttpMethod(cleanText(entry.getHttpMethod(), 16));
        dto.setRequestUri(maskUri(entry.getRequestUri()));
        dto.setIpAddress(maskIp(entry.getIpAddress()));
        dto.setUserAgent(maskUserAgent(entry.getUserAgent()));
        dto.setBeforeRecordSummary(summarizePayload(entry.getBeforeRecord()));
        dto.setAfterRecordSummary(summarizePayload(entry.getAfterRecord()));
        dto.setRawPayloadSummary(summarizePayload(entry.getRawPayload()));
        dto.setErrorSummary(maskError(firstText(entry.getErrorMessage(), entry.getErrorStack(), null)));
        dto.setStatus(cleanText(entry.getStatus(), 32));
        dto.setCreatedAt(entry.getTimestamp() != null ? entry.getTimestamp() : entry.getCreatedAt());
        dto.setMasked(true);
        dto.setTenantScoped(true);
        dto.setReadonlyBoundary(READONLY_BOUNDARY);
    }

    private NormalizedQuery normalizeQuery(AuditDashboardQueryDTO query, boolean requireRange) {
        AuditDashboardQueryDTO source = query == null ? new AuditDashboardQueryDTO() : query;
        int page = normalizePage(source.getPage());
        int pageSize = normalizePageSize(source.getPageSize() != null ? source.getPageSize() : source.getSize());
        LocalDateTime startTime = source.getStartTime();
        LocalDateTime endTime = source.getEndTime();
        if (startTime == null && source.getStartDate() != null) {
            startTime = source.getStartDate().atStartOfDay();
        }
        if (endTime == null && source.getEndDate() != null) {
            endTime = source.getEndDate().atTime(LocalTime.MAX);
        }
        if (startTime == null || endTime == null) {
            if (requireRange) {
                LocalDate today = LocalDate.now();
                startTime = today.minusDays(6).atStartOfDay();
                endTime = today.plusDays(1).atStartOfDay();
            }
        }
        validateRange(startTime, endTime);
        String granularity = normalizeGranularity(source.getGranularity(), startTime, endTime);
        String operationType = normalizeToken(firstText(source.getOperationType(), source.getActionType(), null), 64);
        String operatorName = normalizeText(source.getOperatorName(), 64);
        String resourceType = normalizeToken(source.getResourceType(), 64);
        String resourceId = normalizeText(source.getResourceId(), 128);
        String keyword = normalizeText(firstText(source.getKeyword(), source.getSearch(), null), 80);
        return new NormalizedQuery(
                page,
                pageSize,
                Math.max((page - 1) * pageSize, 0),
                startTime,
                endTime,
                granularity,
                operationType,
                source.getOperatorId(),
                operatorName,
                resourceType,
                resourceId,
                keyword
        );
    }

    private int normalizePage(Integer page) {
        return page == null || page < DEFAULT_PAGE ? DEFAULT_PAGE : page;
    }

    private int normalizePageSize(Integer pageSize) {
        if (pageSize == null || pageSize < 1) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(pageSize, MAX_PAGE_SIZE);
    }

    private int normalizeLimit(Integer limit, int fallback, int max) {
        if (limit == null || limit < 1) {
            return fallback;
        }
        return Math.min(limit, max);
    }

    private void validateRange(LocalDateTime startTime, LocalDateTime endTime) {
        if (startTime == null && endTime == null) {
            return;
        }
        if (startTime == null || endTime == null || !startTime.isBefore(endTime)) {
            throw new BusinessException("审计日志时间范围不合法");
        }
        if (Duration.between(startTime, endTime).toDays() > MAX_RANGE_DAYS) {
            throw new BusinessException("审计日志时间范围不能超过365天");
        }
    }

    private String normalizeGranularity(String value, LocalDateTime startTime, LocalDateTime endTime) {
        String granularity = firstText(value, "daily").trim().toLowerCase(Locale.ROOT);
        if (!Set.of("daily", "hourly").contains(granularity)) {
            throw new BusinessException("审计日志趋势粒度不受支持");
        }
        if ("hourly".equals(granularity) && startTime != null && endTime != null && Duration.between(startTime, endTime).toDays() > 3) {
            throw new BusinessException("小时粒度时间范围不能超过3天");
        }
        return granularity;
    }

    private String summarizePayload(String value) {
        String source = cleanText(value, 2000);
        if (source == null) {
            return null;
        }
        try {
            Object parsed = objectMapper.readValue(source, Object.class);
            Object redacted = redactJson(parsed);
            return truncate(objectMapper.writeValueAsString(redacted), 360);
        } catch (JsonProcessingException ex) {
            String masked = SENSITIVE_ASSIGNMENT.matcher(source).replaceAll("$1=******");
            return "payload(length=" + source.length() + ", sha256=" + fingerprint(source) + ", preview=" + truncate(masked, 120) + ")";
        }
    }

    @SuppressWarnings("unchecked")
    private Object redactJson(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> redacted = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                if (isSensitiveKey(key)) {
                    redacted.put(key, "******");
                } else {
                    redacted.put(key, redactJson(entry.getValue()));
                }
            }
            return redacted;
        }
        if (value instanceof List<?> list) {
            return list.stream().map(this::redactJson).toList();
        }
        if (value instanceof String text) {
            return SENSITIVE_ASSIGNMENT.matcher(text).replaceAll("$1=******");
        }
        return value;
    }

    private boolean isSensitiveKey(String key) {
        String normalized = key == null ? "" : key.replaceAll("[^A-Za-z0-9]", "").toLowerCase(Locale.ROOT);
        return SENSITIVE_KEYS.stream().anyMatch(normalized::contains);
    }

    private String maskUri(String requestUri) {
        String source = normalizeText(requestUri, 512);
        if (source == null) {
            return null;
        }
        try {
            URI uri = new URI(source);
            String path = firstText(uri.getPath(), source.split("\\?")[0]);
            return truncate(maskPath(path), 180) + (uri.getRawQuery() == null ? "" : "?query=redacted");
        } catch (Exception ex) {
            String[] parts = source.split("\\?", 2);
            return truncate(maskPath(parts[0]), 180) + (parts.length > 1 ? "?query=redacted" : "");
        }
    }

    private String maskPath(String path) {
        if (path == null || path.isBlank()) {
            return "/";
        }
        String[] segments = path.split("/", -1);
        for (int i = 0; i < segments.length; i++) {
            String segment = segments[i];
            if (segment.length() > 12 || segment.matches(".*\\d.*")) {
                segments[i] = maskResourceId(segment);
            }
        }
        return String.join("/", segments);
    }

    private String maskResourceId(String value) {
        String source = normalizeText(value, 128);
        if (source == null) {
            return null;
        }
        if (source.length() <= 4) {
            return "****";
        }
        return source.substring(0, 2) + "****" + source.substring(source.length() - 2);
    }

    private String maskIp(String value) {
        String source = normalizeText(value, 64);
        if (source == null) {
            return null;
        }
        if (source.matches("\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}")) {
            String[] parts = source.split("\\.");
            return parts[0] + "." + parts[1] + ".*." + "*";
        }
        if (source.contains(":")) {
            return source.substring(0, Math.min(source.indexOf(':'), 8)) + "::****";
        }
        return "已脱敏";
    }

    private String maskUserAgent(String value) {
        String source = cleanText(value, 240);
        if (source == null) {
            return null;
        }
        String masked = SENSITIVE_ASSIGNMENT.matcher(source).replaceAll("$1=******");
        return truncate(masked, 96);
    }

    private String maskError(String value) {
        String source = cleanText(value, 512);
        if (source == null) {
            return null;
        }
        return truncate(SENSITIVE_ASSIGNMENT.matcher(source).replaceAll("$1=******"), 160);
    }

    private String safeTrace(String value) {
        return normalizeToken(value, 96);
    }

    private String cleanText(String value, int maxLength) {
        String normalized = normalizeText(value, maxLength);
        if (normalized == null) {
            return null;
        }
        return SENSITIVE_ASSIGNMENT.matcher(normalized).replaceAll("$1=******");
    }

    private String normalizeToken(String value, int maxLength) {
        String normalized = normalizeText(value, maxLength);
        if (normalized == null) {
            return null;
        }
        if (!normalized.matches("[A-Za-z0-9_:\\-.]+")) {
            throw new BusinessException("审计日志筛选参数不合法");
        }
        return normalized;
    }

    private String normalizeText(String value, int maxLength) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return truncate(value.replaceAll("[\\r\\n]", " ").trim(), maxLength);
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength) + "…";
    }

    private String fingerprint(String source) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(source.getBytes(StandardCharsets.UTF_8))).substring(0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new AccessDeniedException("审计摘要生成失败");
        }
    }

    private String firstText(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private record NormalizedQuery(
            int page,
            int pageSize,
            int offset,
            LocalDateTime startTime,
            LocalDateTime endTime,
            String granularity,
            String operationType,
            Long operatorId,
            String operatorName,
            String resourceType,
            String resourceId,
            String keyword
    ) {
    }
}
