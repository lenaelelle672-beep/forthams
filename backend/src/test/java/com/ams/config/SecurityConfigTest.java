package com.ams.config;

import com.ams.security.SsoSuccessHandler;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class SecurityConfigTest {

    @Test
    void defaultCorsOriginsShouldAllowLocalhostAndLoopbackDevServers() {
        SecurityConfig securityConfig = new SecurityConfig(
                mock(JwtAuthenticationFilter.class),
                mock(org.springframework.security.core.userdetails.UserDetailsService.class),
                mock(SsoSuccessHandler.class)
        );
        ReflectionTestUtils.setField(
                securityConfig,
                "corsAllowedOrigins",
                "http://localhost:5173,http://127.0.0.1:5173"
        );

        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/login");
        CorsConfiguration configuration = securityConfig.corsConfigurationSource().getCorsConfiguration(request);

        assertThat(configuration).isNotNull();
        assertThat(configuration.getAllowedOriginPatterns())
                .containsExactly("http://localhost:5173", "http://127.0.0.1:5173");
    }
}
