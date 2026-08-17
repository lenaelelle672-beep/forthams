package com.ams.utils;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Component
public class JwtUtil {

    private static final int MIN_SECRET_UTF8_BYTES = 32;

    /**
     * JWT 签名密钥。必须通过 JWT_SECRET 环境变量设置（至少 256 位/32 字节）。
     * 此前 application.yml 有公开默认值，任何读代码的人都能伪造 token。
     * 现 fail-fast：如果密钥是已知的公开默认值或为空，启动时抛异常。
     */
    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private Long expiration;

    private static final java.util.Set<String> KNOWN_INSECURE_DEFAULTS = java.util.Set.of(
            "ams-secret-key-for-jwt-token-generation-must-be-at-least-256-bits-long",
            "AMS_SECRET_KEY_FOR_JWT_TOKEN_GENERATION_2024_VERY_LONG_SECRET"
    );

    @jakarta.annotation.PostConstruct
    void validateSecret() {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("JWT_SECRET 未设置：必须通过环境变量配置 JWT 签名密钥");
        }
        if (KNOWN_INSECURE_DEFAULTS.contains(secret)) {
            throw new IllegalStateException("JWT_SECRET 使用了公开默认值，存在认证伪造风险：必须设置自定义 JWT_SECRET 环境变量");
        }
        if (secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_UTF8_BYTES) {
            throw new IllegalStateException("JWT_SECRET 至少需要32个UTF-8字节");
        }
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(String username, Long userId, String tenantId) {
        return generateToken(username, userId, tenantId, 0);
    }

    public String generateToken(String username, Long userId, String tenantId, Integer tokenVersion) {
        if (username == null || username.isBlank() || userId == null || userId <= 0 || tenantId == null || tenantId.isBlank()) {
            throw new IllegalArgumentException("username, userId and tenantId must not be blank");
        }
        if (tokenVersion == null || tokenVersion < 0) {
            throw new IllegalArgumentException("tokenVersion must not be negative");
        }

        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        claims.put("tenant_id", tenantId);
        claims.put("token_version", tokenVersion);
        return createToken(claims, username);
    }

    private String createToken(Map<String, Object> claims, String subject) {
        Date now = new Date();
        Date expirationDate = new Date(now.getTime() + expiration);

        return Jwts.builder()
                .claims(claims)
                .subject(subject)
                .issuedAt(now)
                .expiration(expirationDate)
                .signWith(getSigningKey())
                .compact();
    }

    public String getUsernameFromToken(String token) {
        return getClaimsFromToken(token).getSubject();
    }

    public Long getUserIdFromToken(String token) {
        Claims claims = getClaimsFromToken(token);
        return claims.get("userId", Long.class);
    }

    public String getTenantIdFromToken(String token) {
        Claims claims = getClaimsFromToken(token);
        return claims.get("tenant_id", String.class);
    }

    public Integer getTokenVersionFromToken(String token) {
        Object value = getClaimsFromToken(token).get("token_version");
        if (!(value instanceof Number number)) {
            return null;
        }
        return number.intValue();
    }

    public boolean validateToken(String token, String username, Long userId, String tenantId) {
        return validateToken(token, username, userId, tenantId, 0);
    }

    public boolean validateToken(String token, String username, Long userId, String tenantId, Integer tokenVersion) {
        if (username == null || username.isBlank() || userId == null || tenantId == null || tenantId.isBlank()) {
            return false;
        }
        if (tokenVersion == null || tokenVersion < 0) {
            return false;
        }
        String tokenUsername = getUsernameFromToken(token);
        return tokenUsername.equals(username)
                && userId.equals(getUserIdFromToken(token))
                && tenantId.equals(getTenantIdFromToken(token))
                && tokenVersion.equals(getTokenVersionFromToken(token))
                && !isTokenExpired(token);
    }

    private Claims getClaimsFromToken(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private boolean isTokenExpired(String token) {
        Date expiration = getClaimsFromToken(token).getExpiration();
        return expiration.before(new Date());
    }

}
