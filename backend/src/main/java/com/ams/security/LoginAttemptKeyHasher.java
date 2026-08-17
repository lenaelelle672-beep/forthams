package com.ams.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.HexFormat;

/** 将认证侧的原始账号/IP 变为带服务端密钥的不可逆存储键。 */
@Component
public class LoginAttemptKeyHasher {

    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final byte[] secret;

    public LoginAttemptKeyHasher(@Value("${app.security.login-rate-limit.identifier-secret}") String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("登录限流标识密钥不能为空");
        }
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    public String hash(String purpose, String value) {
        if (purpose == null || purpose.isBlank() || value == null) {
            throw new IllegalArgumentException("登录限流标识不完整");
        }
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret, HMAC_ALGORITHM));
            return HexFormat.of().formatHex(mac.doFinal((purpose + '\u0000' + value).getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("登录限流标识哈希失败", exception);
        }
    }
}
