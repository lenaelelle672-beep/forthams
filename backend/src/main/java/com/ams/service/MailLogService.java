package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.MailLogDTO;
import com.ams.dto.MailLogDetailDTO;
import com.ams.dto.MailLogMetaDTO;
import com.ams.dto.MailLogQueryDTO;
import com.ams.entity.MailLog;
import com.ams.mapper.MailLogMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MailLogService {

    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_BIZ_LIMIT = 50;
    private static final int MAX_META_LIMIT = 100;
    private static final String READONLY_BOUNDARY = "邮件日志只读 catalog/detail/biz/meta；字段已脱敏，不提供 retry/export/send，不保证日志采集链路或邮件子系统完成。";

    private final MailLogMapper mailLogMapper;

    public MailLogDTO.PageResult list(MailLogQueryDTO query) {
        String tenantId = TenantContext.requireTenantId();
        NormalizedQuery normalized = normalizeQuery(query);
        long total = mailLogMapper.countRecords(
                tenantId,
                normalized.templateCode(),
                normalized.sendStatus(),
                normalized.bizType(),
                normalized.bizId(),
                normalized.keyword()
        );
        List<MailLogDTO> records = total == 0
                ? List.of()
                : mailLogMapper.selectPageRecords(
                        tenantId,
                        normalized.templateCode(),
                        normalized.sendStatus(),
                        normalized.bizType(),
                        normalized.bizId(),
                        normalized.keyword(),
                        normalized.pageSize(),
                        normalized.offset()
                ).stream().map(this::toDTO).toList();
        long pages = total == 0 ? 0 : (long) Math.ceil((double) total / normalized.pageSize());
        return MailLogDTO.PageResult.builder()
                .records(records)
                .total(total)
                .size(normalized.pageSize())
                .current(normalized.page())
                .pages(pages)
                .redacted(true)
                .tenantScoped(true)
                .readOnly(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .redactionPolicy(redactionPolicy())
                .build();
    }

    public MailLogDetailDTO detail(Long id) {
        String tenantId = TenantContext.requireTenantId();
        if (id == null || id <= 0) {
            throw new BusinessException("邮件日志不存在");
        }
        MailLog log = mailLogMapper.selectByIdAndTenant(tenantId, id);
        if (log == null) {
            throw new BusinessException("邮件日志不存在");
        }
        return toDetailDTO(log);
    }

    public List<MailLogDTO> getByBiz(String bizType, Long bizId) {
        String tenantId = TenantContext.requireTenantId();
        String type = cleanToken(bizType, 64);
        if (type == null || bizId == null || bizId <= 0) {
            throw new BusinessException("业务邮件日志不存在");
        }
        return mailLogMapper.selectByBizAndTenant(tenantId, type, bizId, MAX_BIZ_LIMIT)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    public MailLogMetaDTO meta() {
        String tenantId = TenantContext.requireTenantId();
        return MailLogMetaDTO.builder()
                .sendStatuses(mergeOptions(
                        mailLogMapper.listSendStatuses(tenantId, MAX_META_LIMIT),
                        Map.of("PENDING", "待发送", "SUCCESS", "发送成功", "FAILED", "发送失败")
                ))
                .bizTypes(toOptions(mailLogMapper.listBizTypes(tenantId, MAX_META_LIMIT)))
                .templateCodes(toOptions(mailLogMapper.listTemplateCodes(tenantId, MAX_META_LIMIT)))
                .redactionPolicy(redactionPolicy())
                .nonGoals(nonGoals())
                .redacted(true)
                .tenantScoped(true)
                .readOnly(true)
                .collectionGuaranteed(false)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    private MailLogDTO toDTO(MailLog log) {
        return MailLogDTO.builder()
                .id(log.getId())
                .tenantId(log.getTenantId())
                .templateCode(log.getTemplateCode())
                .maskedMailFrom(maskEmailList(log.getMailFrom()))
                .maskedMailTo(maskEmailList(log.getMailTo()))
                .maskedMailCc(maskEmailList(log.getMailCc()))
                .maskedMailBcc(maskEmailList(log.getMailBcc()))
                .maskedSubject(maskText(log.getSubject(), "主题"))
                .maskedBodySummary(maskText(log.getContent(), "正文"))
                .sendStatus(log.getSendStatus())
                .diagnosticSummary(diagnosticSummary(log))
                .retryCount(log.getRetryCount())
                .maxRetry(log.getMaxRetry())
                .bizType(log.getBizType())
                .bizId(log.getBizId())
                .sendTime(log.getSendTime())
                .createTime(log.getCreateTime())
                .redacted(true)
                .tenantScoped(true)
                .readOnly(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .build();
    }

    private MailLogDetailDTO toDetailDTO(MailLog log) {
        return MailLogDetailDTO.builder()
                .id(log.getId())
                .tenantId(log.getTenantId())
                .templateCode(log.getTemplateCode())
                .maskedMailFrom(maskEmailList(log.getMailFrom()))
                .maskedMailTo(maskEmailList(log.getMailTo()))
                .maskedMailCc(maskEmailList(log.getMailCc()))
                .maskedMailBcc(maskEmailList(log.getMailBcc()))
                .maskedSubject(maskText(log.getSubject(), "主题"))
                .maskedBodySummary(maskText(log.getContent(), "正文"))
                .sendStatus(log.getSendStatus())
                .diagnosticSummary(diagnosticSummary(log))
                .retryCount(log.getRetryCount())
                .maxRetry(log.getMaxRetry())
                .bizType(log.getBizType())
                .bizId(log.getBizId())
                .sendTime(log.getSendTime())
                .createTime(log.getCreateTime())
                .updateTime(log.getUpdateTime())
                .redacted(true)
                .tenantScoped(true)
                .readOnly(true)
                .readonlyBoundary(READONLY_BOUNDARY)
                .redactionPolicy(redactionPolicy())
                .nonGoals(nonGoals())
                .build();
    }

    private NormalizedQuery normalizeQuery(MailLogQueryDTO query) {
        MailLogQueryDTO source = query == null ? new MailLogQueryDTO() : query;
        int page = source.getPage() == null || source.getPage() < DEFAULT_PAGE ? DEFAULT_PAGE : source.getPage();
        int requestedSize = firstNumber(source.getPageSize(), source.getSize(), DEFAULT_PAGE_SIZE);
        int pageSize = requestedSize < 1 ? DEFAULT_PAGE_SIZE : Math.min(requestedSize, MAX_PAGE_SIZE);
        return new NormalizedQuery(
                page,
                pageSize,
                Math.max((page - 1) * pageSize, 0),
                cleanToken(source.getTemplateCode(), 96),
                cleanStatus(source.getSendStatus()),
                cleanToken(source.getBizType(), 64),
                source.getBizId() == null || source.getBizId() <= 0 ? null : source.getBizId(),
                cleanText(source.getKeyword(), 80)
        );
    }

    private String diagnosticSummary(MailLog log) {
        List<String> parts = new ArrayList<>();
        parts.add("状态=" + nullToDash(log.getSendStatus()));
        parts.add("重试=" + (log.getRetryCount() == null ? 0 : log.getRetryCount()) + "/" + (log.getMaxRetry() == null ? 0 : log.getMaxRetry()));
        if (cleanText(log.getErrorMessage(), 4096) != null) {
            parts.add("错误详情已脱敏");
        }
        if (hasAny(log.getProvider(), log.getProviderMessageId(), log.getRequestId(), log.getHeaders(), log.getPayload())) {
            parts.add("供应商标识、请求标识、头信息与载荷已隐藏");
        }
        return String.join("；", parts);
    }

    private List<String> redactionPolicy() {
        return List.of(
                "收件人、抄送、密送与发件人只返回掩码",
                "主题、正文、错误详情、供应商标识、请求标识、头信息与载荷只返回脱敏摘要",
                "详情页同样只读脱敏，不提供原文、复制、下载或导出"
        );
    }

    private List<String> nonGoals() {
        return List.of(
                "不提供 retry/replay/resend",
                "不提供 export/download",
                "不发送邮件或测试发送",
                "不配置 SMTP/邮件网关",
                "不保证邮件日志采集链路、retention/WORM/compliance 完成",
                "不代表邮件子系统或消息与通知组完成"
        );
    }

    private List<MailLogMetaDTO.Option> mergeOptions(List<String> observed, Map<String, String> defaults) {
        LinkedHashMap<String, String> values = new LinkedHashMap<>(defaults);
        if (observed != null) {
            for (String item : observed) {
                String value = cleanToken(item, 64);
                if (value != null) {
                    values.putIfAbsent(value, value);
                }
            }
        }
        return values.entrySet().stream().map(entry -> option(entry.getKey(), entry.getValue())).toList();
    }

    private List<MailLogMetaDTO.Option> toOptions(List<String> observed) {
        if (observed == null) {
            return List.of();
        }
        return observed.stream()
                .map(value -> cleanToken(value, 96))
                .filter(value -> value != null)
                .distinct()
                .map(value -> option(value, value))
                .toList();
    }

    private MailLogMetaDTO.Option option(String value, String label) {
        return MailLogMetaDTO.Option.builder().value(value).label(label).build();
    }

    private String maskEmailList(String value) {
        String text = cleanText(value, 2048);
        if (text == null) {
            return null;
        }
        String[] items = text.split("[,;\\s]+");
        List<String> masked = new ArrayList<>();
        for (String item : items) {
            String trimmed = cleanText(item, 256);
            if (trimmed != null) {
                masked.add(maskEmail(trimmed));
            }
        }
        return masked.isEmpty() ? "[已脱敏]" : String.join(", ", masked);
    }

    private String maskEmail(String value) {
        int at = value.indexOf('@');
        if (at <= 0 || at >= value.length() - 1) {
            return "[已脱敏]";
        }
        char local = value.charAt(0);
        char domain = value.charAt(at + 1);
        return local + "***@" + domain + "***";
    }

    private String maskText(String value, String label) {
        String text = cleanText(value, 8192);
        if (text == null) {
            return null;
        }
        return label + "已脱敏，长度=" + text.length();
    }

    private String cleanStatus(String value) {
        String status = cleanToken(value, 32);
        return status == null ? null : status.toUpperCase(Locale.ROOT);
    }

    private String cleanToken(String value, int maxLength) {
        String text = cleanText(value, maxLength);
        if (text == null) {
            return null;
        }
        return text.replaceAll("[^A-Za-z0-9_\\-]", "");
    }

    private String cleanText(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String text = value.trim();
        return text.length() > maxLength ? text.substring(0, maxLength) : text;
    }

    private int firstNumber(Integer first, Integer second, int fallback) {
        if (first != null) {
            return first;
        }
        return second == null ? fallback : second;
    }

    private String nullToDash(String value) {
        String text = cleanText(value, 64);
        return text == null ? "-" : text;
    }

    private boolean hasAny(String... values) {
        for (String value : values) {
            if (cleanText(value, 64) != null) {
                return true;
            }
        }
        return false;
    }

    private record NormalizedQuery(int page, int pageSize, int offset, String templateCode, String sendStatus, String bizType, Long bizId, String keyword) {}
}
