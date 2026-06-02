package com.ams.service;

import com.ams.entity.SystemConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class NumberingRuleService {

    private static final String SEQ_TOKEN = "{SEQ}";

    private final SystemConfigService systemConfigService;

    public synchronized String generate(
            String configKey,
            String fallbackPattern,
            Function<String, List<String>> existingNumbersByPrefix,
            int sequenceWidth) {
        return generate(List.of(configKey), fallbackPattern, existingNumbersByPrefix, sequenceWidth);
    }

    public synchronized String generate(
            List<String> configKeys,
            String fallbackPattern,
            Function<String, List<String>> existingNumbersByPrefix,
            int sequenceWidth) {
        String pattern = resolvePattern(configKeys, fallbackPattern);
        LocalDateTime now = LocalDateTime.now();
        int seqIndex = pattern.indexOf(SEQ_TOKEN);
        if (seqIndex < 0) {
            return renderDateTokens(pattern, now);
        }

        String prefix = renderDateTokens(pattern.substring(0, seqIndex), now);
        String suffix = renderDateTokens(pattern.substring(seqIndex + SEQ_TOKEN.length()), now);
        List<String> existingNumbers = existingNumbersByPrefix.apply(prefix);
        int nextSequence = resolveNextSequence(existingNumbers, prefix, suffix);
        return prefix + String.format("%0" + Math.max(sequenceWidth, 1) + "d", nextSequence) + suffix;
    }

    private String resolvePattern(List<String> configKeys, String fallbackPattern) {
        for (String configKey : configKeys == null ? List.<String>of() : configKeys) {
            if (!StringUtils.hasText(configKey)) {
                continue;
            }
            try {
                SystemConfig config = systemConfigService.getByKey(configKey);
                if (config != null && StringUtils.hasText(config.getConfigValue())) {
                    return config.getConfigValue().trim();
                }
            } catch (Exception ignored) {
                // Configuration lookup must not block business document creation.
            }
        }
        return fallbackPattern;
    }

    private int resolveNextSequence(List<String> existingNumbers, String prefix, String suffix) {
        int maxSequence = 0;
        for (String number : existingNumbers == null ? List.<String>of() : existingNumbers) {
            if (number == null || !number.startsWith(prefix)) {
                continue;
            }
            if (!suffix.isEmpty() && !number.endsWith(suffix)) {
                continue;
            }
            int start = prefix.length();
            int end = suffix.isEmpty() ? number.length() : number.length() - suffix.length();
            if (end <= start) {
                continue;
            }
            try {
                maxSequence = Math.max(maxSequence, Integer.parseInt(number.substring(start, end)));
            } catch (NumberFormatException ignored) {
                // Ignore malformed historical numbers.
            }
        }
        return maxSequence + 1;
    }

    private String renderDateTokens(String pattern, LocalDateTime now) {
        String year = String.valueOf(now.getYear());
        String shortYear = year.substring(2);
        String month = pad(now.getMonthValue());
        String day = pad(now.getDayOfMonth());
        String hour = pad(now.getHour());
        String minute = pad(now.getMinute());
        String second = pad(now.getSecond());
        return pattern
                .replace("{YYYYMMDD}", year + month + day)
                .replace("{YYYYMM}", year + month)
                .replace("{YYMMDD}", shortYear + month + day)
                .replace("{YYYY}", year)
                .replace("{YY}", shortYear)
                .replace("{MM}", month)
                .replace("{DD}", day)
                .replace("{HH}", hour)
                .replace("{MI}", minute)
                .replace("{SS}", second);
    }

    private String pad(int value) {
        return String.valueOf(value).length() >= 2 ? String.valueOf(value) : "0" + value;
    }
}
