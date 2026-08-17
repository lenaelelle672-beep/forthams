package com.ams.service;

import com.ams.dto.AuthResponse;
import com.ams.dto.LoginRequest;
import com.ams.dto.RegisterRequest;
import com.ams.entity.GeneralAuditEntry;
import com.ams.entity.SysTenant;
import com.ams.entity.User;
import com.ams.mapper.SysTenantMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.mapper.UserTenantMembershipMapper;
import com.ams.service.impl.UserDetailsServiceImpl;
import com.ams.security.LoginAttemptKeyHasher;
import com.ams.security.LoginAttemptReservation;
import com.ams.security.LoginAttemptTracker;
import com.ams.utils.JwtUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final LoginAttemptReservation RESERVATION =
            new LoginAttemptReservation("00000000-0000-4000-8000-000000000001");

    @Mock
    private UserMapper userMapper;

    @Mock
    private JwtUtil jwtUtil;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private SysTenantMapper sysTenantMapper;

    @Mock
    private UserDetailsServiceImpl userDetailsService;

    @Mock
    private UserTenantMembershipMapper userTenantMembershipMapper;

    @Mock
    private UserRoleMapper userRoleMapper;

    @Mock
    private UserDetails userDetails;

    @Mock
    private LoginAttemptTracker loginAttemptTracker;

    @Mock
    private LoginAttemptKeyHasher loginAttemptKeyHasher;

    @Mock
    private AuditService auditService;

    @InjectMocks
    private AuthService authService;

    @BeforeEach
    void setUpRateLimitHashes() {
        lenient().when(loginAttemptKeyHasher.hash("account", "alice")).thenReturn("account-hash");
        lenient().when(loginAttemptKeyHasher.hash("client-ip", "unknown")).thenReturn("unknown-ip-hash");
        lenient().when(loginAttemptKeyHasher.hash("client-ip", "203.0.113.8")).thenReturn("blocked-ip-hash");
        lenient().when(loginAttemptKeyHasher.hash("client-ip", "203.0.113.9")).thenReturn("failure-ip-hash");
        lenient().when(loginAttemptTracker.reserve(any(), any())).thenReturn(Optional.of(RESERVATION));
        lenient().when(userRoleMapper.selectRoleCodesByUserIdAndTenantId(7L, "T001"))
                .thenReturn(List.of("TENANT_ADMIN"));
        lenient().when(userRoleMapper.selectPermissionCodesByUserIdAndTenantId(7L, "T001"))
                .thenReturn(List.of("asset:query"));
    }

    @Test
    void loginUsesServerStoredTenantMembershipRatherThanDepartment() {
        authenticateSuccessfully();
        User user = user("T001", 99L);
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user);
        when(userTenantMembershipMapper.selectActiveTenantIdsByUserId(7L)).thenReturn(List.of("T001"));
        when(sysTenantMapper.selectById("T001")).thenReturn(activeTenant("T001"));
        when(userDetailsService.loadUserByUsernameAndTenantId("alice", 7L, "T001")).thenReturn(userDetails);
        when(jwtUtil.generateToken("alice", 7L, "T001", 0)).thenReturn("tenant-jwt");

        AuthResponse response = authService.login(loginRequest());

        assertThat(response.getToken()).isEqualTo("tenant-jwt");
        assertThat(response.getRoles()).containsExactly("TENANT_ADMIN");
        assertThat(response.getPermissions()).containsExactly("asset:query");
        assertThat(response.getPlatformAdmin()).isFalse();
        verify(jwtUtil).generateToken("alice", 7L, "T001", 0);
        verify(loginAttemptTracker).recordSuccess(RESERVATION);
        verify(userRoleMapper).selectRoleCodesByUserIdAndTenantId(7L, "T001");
    }

    @Test
    void loginRejectsUserWithoutServerStoredTenantMembership() {
        authenticateSuccessfully();
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user(null, 10L));

        assertThatThrownBy(() -> authService.login(loginRequest()))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage("认证失败");

        verify(jwtUtil, never()).generateToken(any(), any(), any());
        verifyNoInteractions(sysTenantMapper, userDetailsService, userTenantMembershipMapper, userRoleMapper);
    }

    @Test
    void loginRejectsUserWhenDefaultTenantHasNoActiveMembership() {
        authenticateSuccessfully();
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user("T001", 10L));
        when(userTenantMembershipMapper.selectActiveTenantIdsByUserId(7L)).thenReturn(List.of());

        assertThatThrownBy(() -> authService.login(loginRequest()))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage("认证失败");

        verify(jwtUtil, never()).generateToken(any(), any(), any());
        verifyNoInteractions(sysTenantMapper, userDetailsService);
    }

    @Test
    void loginRejectsAmbiguousServerSideTenantMemberships() {
        authenticateSuccessfully();
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user("T001", 10L));
        when(userTenantMembershipMapper.selectActiveTenantIdsByUserId(7L)).thenReturn(List.of("T001", "T002"));

        assertThatThrownBy(() -> authService.login(loginRequest()))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage("认证失败");

        verify(jwtUtil, never()).generateToken(any(), any(), any());
        verifyNoInteractions(sysTenantMapper, userDetailsService);
    }

    @Test
    void publicRegisterAlwaysRejectsWithoutPersistingOrIssuingToken() {
        assertThatThrownBy(() -> authService.register(new RegisterRequest()))
                .isInstanceOf(AccessDeniedException.class);

        verifyNoInteractions(userMapper, jwtUtil, authenticationManager, sysTenantMapper, userDetailsService, userRoleMapper);
    }

    @Test
    void credentialFailureUsesTheSameSafeResponseAsAccountAndMembershipFailures() {
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("密码错误"));

        assertThatThrownBy(() -> authService.login(loginRequest()))
                .isInstanceOf(AuthenticationException.class)
                .hasMessage("认证失败");

        verifyNoInteractions(userMapper, jwtUtil, sysTenantMapper, userDetailsService, userTenantMembershipMapper, userRoleMapper);
    }

    @Test
    void missingAccountUsesTheSameSafeResponseAsCredentialAndMembershipFailures() {
        authenticateSuccessfully();
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        assertThatThrownBy(() -> authService.login(loginRequest()))
                .isInstanceOf(AuthenticationException.class)
                .hasMessage("认证失败");

        verifyNoInteractions(jwtUtil, sysTenantMapper, userDetailsService, userTenantMembershipMapper, userRoleMapper);
    }

    @Test
    void blockedLoginUsesTheSameSafeResponseWithoutReachingAuthentication() {
        when(loginAttemptTracker.reserve("account-hash", "blocked-ip-hash")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(loginRequest(), "203.0.113.8"))
                .isInstanceOf(AuthenticationException.class)
                .hasMessage("认证失败");

        verifyNoInteractions(authenticationManager, userMapper, jwtUtil, sysTenantMapper, userDetailsService,
                userTenantMembershipMapper, userRoleMapper);
        verify(auditService).save(any(GeneralAuditEntry.class));
    }

    @Test
    void credentialFailureFinalizesThePreReservedAccountAndIpAttemptWithoutAuditingTheRawAccount() {
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("密码错误"));

        assertThatThrownBy(() -> authService.login(loginRequest(), "203.0.113.9"))
                .isInstanceOf(AuthenticationException.class)
                .hasMessage("认证失败");

        verify(loginAttemptTracker).recordFailure(RESERVATION);
        ArgumentCaptor<GeneralAuditEntry> entryCaptor = ArgumentCaptor.forClass(GeneralAuditEntry.class);
        verify(auditService).save(entryCaptor.capture());
        assertThat(entryCaptor.getValue().getStatus()).isEqualTo("FAILURE");
        assertThat(entryCaptor.getValue().getIpAddress()).isEqualTo("failure-ip-hash");
        assertThat(entryCaptor.getValue().getResourceId()).doesNotContain("alice");
    }

    @Test
    void loginReservesSharedQuotaBeforePasswordVerification() {
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("密码错误"));

        assertThatThrownBy(() -> authService.login(loginRequest(), "203.0.113.9"))
                .isInstanceOf(AuthenticationException.class)
                .hasMessage("认证失败");

        InOrder order = inOrder(loginAttemptTracker, authenticationManager);
        order.verify(loginAttemptTracker).reserve("account-hash", "failure-ip-hash");
        order.verify(authenticationManager).authenticate(any());
        order.verify(loginAttemptTracker).recordFailure(RESERVATION);
    }

    @Test
    void reserveFailureFailsClosedBeforePasswordVerification() {
        when(loginAttemptTracker.reserve("account-hash", "blocked-ip-hash"))
                .thenThrow(new IllegalStateException("transaction rolled back"));

        assertThatThrownBy(() -> authService.login(loginRequest(), "203.0.113.8"))
                .isInstanceOf(AuthenticationException.class)
                .hasMessage("认证失败");

        verifyNoInteractions(authenticationManager, userMapper, jwtUtil, sysTenantMapper, userDetailsService,
                userTenantMembershipMapper, userRoleMapper);
        verify(auditService).save(any(GeneralAuditEntry.class));
    }

    @Test
    void loginReturnsPlatformAdminFlagAndNeverExposesPasswordHash() {
        authenticateSuccessfully();
        User user = user("T001", 99L);
        user.setPassword("$2a$10$hashed-secret");
        user.setPlatformAdmin(true);
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user);
        when(userTenantMembershipMapper.selectActiveTenantIdsByUserId(7L)).thenReturn(List.of("T001"));
        when(sysTenantMapper.selectById("T001")).thenReturn(activeTenant("T001"));
        when(userDetailsService.loadUserByUsernameAndTenantId("alice", 7L, "T001")).thenReturn(userDetails);
        when(jwtUtil.generateToken("alice", 7L, "T001", 0)).thenReturn("tenant-jwt");

        AuthResponse response = authService.login(loginRequest());

        assertThat(response.getPlatformAdmin()).isTrue();
        assertThat(response.getRoles()).containsExactly("TENANT_ADMIN");
        assertThat(response.getPermissions()).doesNotContain("$2a$10$hashed-secret");
    }

    private LoginRequest loginRequest() {
        LoginRequest request = new LoginRequest();
        request.setUsername("alice");
        request.setPassword("password");
        return request;
    }

    private void authenticateSuccessfully() {
        when(authenticationManager.authenticate(any())).thenReturn(
                new UsernamePasswordAuthenticationToken("alice", "password", List.of()));
    }

    private User user(String tenantId, Long deptId) {
        User user = new User();
        user.setId(7L);
        user.setTenantId(tenantId);
        user.setDeptId(deptId);
        user.setUsername("alice");
        user.setRealName("Alice");
        user.setStatus(1);
        return user;
    }

    private SysTenant activeTenant(String id) {
        SysTenant tenant = new SysTenant();
        tenant.setId(id);
        tenant.setStatus("ACTIVE");
        return tenant;
    }
}
