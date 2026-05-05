package com.ams.utils;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtUtilTest {

    private final JwtUtil jwtUtil = new JwtUtil();

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(jwtUtil, "secret", "aVeryLongDefaultSecretKeyForTestingThatIsAtLeast256BitsLong");
        ReflectionTestUtils.setField(jwtUtil, "expiration", 3600_000L);
    }

    @Test
    void generateTokenUsesProvidedTenantId() {
        String token = jwtUtil.generateToken("alice", 1L, "dept:7");

        assertThat(jwtUtil.getUsernameFromToken(token)).isEqualTo("alice");
        assertThat(jwtUtil.getUserIdFromToken(token)).isEqualTo(1L);
        assertThat(jwtUtil.getTenantIdFromToken(token)).isEqualTo("dept:7");
        assertThat(jwtUtil.getTenantIdFromToken(token)).isNotEqualTo("default");
    }

    @Test
    void generateTokenRejectsBlankTenantId() {
        assertThatThrownBy(() -> jwtUtil.generateToken("alice", 1L, " "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("tenantId");
    }
}
