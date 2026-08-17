package com.ams.security;

import java.util.regex.Pattern;

/**
 * 登录限流预占的不可推导凭据。它只在认证调用链内流转，不能携带账号或来源地址。
 */
public record LoginAttemptReservation(String id) {

    private static final Pattern RESERVATION_ID = Pattern.compile(
            "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");

    public LoginAttemptReservation {
        if (id == null || !RESERVATION_ID.matcher(id).matches()) {
            throw new IllegalArgumentException("登录限流预占标识格式不合法");
        }
    }
}
