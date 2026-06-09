package com.ams.config;

import com.ams.context.TenantContext;
import com.ams.security.LoginUser;
import com.ams.utils.JwtUtil;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JwtAuthenticationFilterTest {

    private JwtUtil jwtUtil;
    private UserDetailsService userDetailsService;
    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();

        jwtUtil = new JwtUtil();
        ReflectionTestUtils.setField(jwtUtil, "secret", "aVeryLongDefaultSecretKeyForTestingThatIsAtLeast256BitsLong");
        ReflectionTestUtils.setField(jwtUtil, "expiration", 3600_000L);
        userDetailsService = mock(UserDetailsService.class);
        filter = new JwtAuthenticationFilter(jwtUtil, userDetailsService);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test
    void shouldRejectTokenTenantThatDoesNotMatchLoadedUserTenant() throws Exception {
        String token = jwtUtil.generateToken("alice", 7L, "dept:99");
        when(userDetailsService.loadUserByUsername("alice"))
                .thenReturn(loginUser("alice", "dept:42"));

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/assets");
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(TenantContext.getTenantId()).isNull();
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void shouldAuthenticateWhenTokenTenantMatchesLoadedUserTenant() throws Exception {
        String token = jwtUtil.generateToken("alice", 7L, "dept:42");
        when(userDetailsService.loadUserByUsername("alice"))
                .thenReturn(loginUser("alice", "dept:42"));

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/assets");
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        assertThat(TenantContext.getTenantId()).isNull();
        verify(chain).doFilter(any(), any());
    }

    @Test
    void shouldRejectTokenTenantThatDoesNotMatchExistingAuthenticationTenant() throws Exception {
        String token = jwtUtil.generateToken("alice", 7L, "dept:99");
        LoginUser existingUser = loginUser("alice", "dept:42");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(existingUser, null, existingUser.getAuthorities()));

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/assets");
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        assertThat(TenantContext.getTenantId()).isNull();
        verify(userDetailsService, never()).loadUserByUsername(any());
        verify(chain, never()).doFilter(any(), any());
    }

    @Test
    void shouldContinueWhenTokenTenantMatchesExistingAuthenticationTenant() throws Exception {
        String token = jwtUtil.generateToken("alice", 7L, "dept:42");
        LoginUser existingUser = loginUser("alice", "dept:42");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(existingUser, null, existingUser.getAuthorities()));

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/assets");
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(SecurityContextHolder.getContext().getAuthentication().getPrincipal()).isSameAs(existingUser);
        assertThat(TenantContext.getTenantId()).isNull();
        verify(userDetailsService, never()).loadUserByUsername(any());
        verify(chain).doFilter(any(), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/vendor-portal/contracts",
            "/health",
            "/system/health",
            "/system/info",
            "/oauth2-mock/login",
            "/sso/callback",
            "/api-docs/openapi.json",
            "/swagger-ui/index.html"
    })
    void shouldBypassSystemJwtOnPermitAllBoundariesEvenWhenBearerHeaderExists(String path) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.addHeader("Authorization", "Bearer invalid-system-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(TenantContext.getTenantId()).isNull();
        verify(userDetailsService, never()).loadUserByUsername(any());
        verify(chain).doFilter(any(), any());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/vendor-portal/contracts",
            "/api/health",
            "/api/system/health",
            "/api/system/info",
            "/api/oauth2-mock/login",
            "/api/sso/callback",
            "/api/api-docs/openapi.json",
            "/api/swagger-ui/index.html"
    })
    void shouldBypassSystemJwtOnPermitAllBoundariesWithApiContextPath(String path) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.setContextPath("/api");
        request.addHeader("Authorization", "Bearer invalid-system-token");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        assertThat(TenantContext.getTenantId()).isNull();
        verify(userDetailsService, never()).loadUserByUsername(any());
        verify(chain).doFilter(any(), any());
    }

    private LoginUser loginUser(String username, String tenantId) {
        return new LoginUser(
                7L,
                42L,
                tenantId,
                username,
                "encoded-password",
                List.of("USER"),
                List.of("asset:list"),
                List.of(new SimpleGrantedAuthority("asset:list"))
        );
    }
}
