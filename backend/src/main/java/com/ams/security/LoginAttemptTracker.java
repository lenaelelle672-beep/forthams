package com.ams.security;

import java.util.Optional;

/**
 * 登录失败状态的存储边界。入参必须是认证层生成的不可逆账号/IP 指纹，不能传入原始标识。
 */
public interface LoginAttemptTracker {

    /**
     * 必须在任何密码校验前调用。返回空表示账号或 IP bucket 已无可用额度；非空预占必须恰好
     * 由一次成功或失败结算，未结算预占在共享存储中保持 fail-closed 直到过期。
     */
    Optional<LoginAttemptReservation> reserve(String accountHash, String clientIpHash);

    void recordFailure(LoginAttemptReservation reservation);

    void recordSuccess(LoginAttemptReservation reservation);
}
