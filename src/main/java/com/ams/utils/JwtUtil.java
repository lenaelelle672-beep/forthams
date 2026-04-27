package com.ams.utils;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SignatureException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import java.util.function.Function;

/**
 * JWT utility class for token generation, validation, and claim extraction.
 *
 * <p>Supports multi-tenant architecture by extracting {@code tenant_id} from
 * JWT claims, enabling automatic tenant context injection via {@code TenantContext}.</p>
 *
 * <p>Token format requirements (per SPEC Phase 1):
 * <ul>
 *   <li>Must contain a {@code tenant_id} claim (VARCHAR/BIGINT compatible)</li>
 *   <li>Missing {@code tenant_id} results in request rejection (403 Forbidden)</li>
 * </ul>
 */
@Slf4j
@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secretKeyString;

    @Value("${jwt.expiration-ms:3600000}")
    private long expirationMs;

    /**
     * Extracts the {@code tenant_id} claim from a JWT token.
     *
     * <p>This method is the primary entry point for multi-tenant context
     * establishment. The calling filter ({@code JwtAuthenticationFilter})
     * must check the return value: a {@code null} result indicates the
     * token is missing the mandatory {@code tenant_id} claim, and the
     * request must be rejected with HTTP 403.</p>
     *
     * @param token the JWT token string (without "Bearer " prefix)
     * @return the tenant ID as a String, or {@code null} if the claim is absent or parsing fails
     */
    public String extractTenantId(String token) {
        try {
            Claims claims = extractAllClaims(token);
            Object tenantIdObj = claims.get("tenant_id");
            if (tenantIdObj == null) {
                log.warn("JWT token missing required 'tenant_id' claim");
                return null;
            }
            return String.valueOf(tenantIdObj);
        } catch (Exception e) {
            log.error("Failed to extract tenant_id from JWT: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Validates the JWT token integrity and expiration.
     *
     * <p>Checks the cryptographic signature against the configured secret
     * and verifies the token has not expired.</p>
     *
     * @param token the JWT token string to validate
     * @return {@code true} if the token is valid and not expired; {@code false} otherwise
     */
    public boolean validateToken(String token) {
        try {
            Jwts.parserBuilder()
                    .setSigningKey(getSigningKey())
                    .build()
                    .parseClaimsJws(token);
            return true;
        } catch (ExpiredJwtException e) {
            log.warn("JWT expired: {}", e.getMessage());
        } catch (SignatureException e) {
            log.error("Invalid JWT signature");
        } catch (MalformedJwtException e) {
            log.error("Malformed JWT token");
        } catch (IllegalArgumentException e) {
            log.error("JWT claims string is empty");
        } catch (Exception e) {
            log.error("Error validating JWT: {}", e.getMessage());
        }
        return false;
    }

    /**
     * Generates a new JWT token containing the user ID and tenant ID claims.
     *
     * <p>The generated token includes standard claims (iat, exp, sub) plus
     * the mandatory {@code tenant_id} claim required for multi-tenant isolation.</p>
     *
     * @param userId   the subject identifier for the token
     * @param tenantId the tenant identifier to embed in the token claims
     * @return the signed JWT token string
     */
    public String generateToken(String userId, String tenantId) {
        Map<String, Object> claims = Map.of(
                "userId", userId,
                "tenant_id", tenantId
        );

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(userId)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * Extracts the username (subject) from the JWT token.
     *
     * @param token the JWT token string
     * @return the username stored in the token subject
     */
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    /**
     * Extracts a specific claim from the JWT token using a resolver function.
     *
     * @param token          the JWT token string
     * @param claimsResolver a function to extract the desired claim from the Claims object
     * @param <T>            the type of the claim value
     * @return the resolved claim value
     */
    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    /**
     * Parses the JWT token and extracts all claims from the payload.
     *
     * @param token the JWT token string
     * @return the Claims object containing all token claims
     * @throws JwtException if the token is invalid, expired, or has an invalid signature
     */
    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    /**
     * Derives the HMAC-SHA signing key from the configured secret string.
     *
     * <p>The secret must be at least 256 bits (32 bytes) for HS256.</p>
     *
     * @return the SecretKey instance for token signing and verification
     */
    private SecretKey getSigningKey() {
        byte[] keyBytes = secretKeyString.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}