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
import com.ams.security.LoginAttemptKeyHasher;
import com.ams.security.LoginAttemptReservation;
import com.ams.security.LoginAttemptTracker;
import com.ams.service.impl.UserDetailsServiceImpl;
import com.ams.utils.JwtUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final String AUTHENTICATION_FAILURE_MESSAGE = "认证失败";
    private static final String UNAUTHENTICATED_AUDIT_TENANT = "SYSTEM";

    private final UserMapper userMapper;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    private final SysTenantMapper sysTenantMapper;
    private final UserDetailsServiceImpl userDetailsService;
    private final UserTenantMembershipMapper userTenantMembershipMapper;
    private final UserRoleMapper userRoleMapper;
    private final LoginAttemptTracker loginAttemptTracker;
    private final LoginAttemptKeyHasher loginAttemptKeyHasher;
    private final AuditService auditService;

    public AuthResponse login(LoginRequest request) {
        return login(request, "unknown");
    }

    public AuthResponse login(LoginRequest request, String clientIp) {
        String username = request == null || request.getUsername() == null ? "" : request.getUsername().trim();
        String accountKey = normalizeAccountKey(username);
        String normalizedClientIp = normalizeClientIp(clientIp);
        String accountHash;
        String clientIpHash;
        try {
            accountHash = loginAttemptKeyHasher.hash("account", accountKey);
            clientIpHash = loginAttemptKeyHasher.hash("client-ip", normalizedClientIp);
        } catch (RuntimeException exception) {
            log.error("login_rate_limit_identifier_hash_failed", exception);
            throw authenticationFailure();
        }
        LoginAttemptReservation reservation = reserveLoginAttempt(accountHash, clientIpHash);
        if (reservation == null) {
            auditLoginFailure(UNAUTHENTICATED_AUDIT_TENANT, null, accountHash, clientIpHash);
            throw authenticationFailure();
        }

        String auditTenantId = UNAUTHENTICATED_AUDIT_TENANT;
        Long auditUserId = null;
        try {
            if (username.isBlank() || request == null || request.getPassword() == null || request.getPassword().isBlank()) {
                throw authenticationFailure();
            }
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(username, request.getPassword())
            );
            if (authentication == null || !authentication.isAuthenticated()) {
                throw authenticationFailure();
            }

            User user = userMapper.selectOne(
                    new LambdaQueryWrapper<User>().eq(User::getUsername, username)
            );
            if (user != null) {
                auditUserId = user.getId();
                if (user.getTenantId() != null && !user.getTenantId().isBlank()) {
                    auditTenantId = user.getTenantId();
                }
            }

            String tenantId = resolveTenantId(user);
            try {
                userDetailsService.loadUserByUsernameAndTenantId(user.getUsername(), user.getId(), tenantId);
            } catch (UsernameNotFoundException ex) {
                throw authenticationFailure();
            }
            String token = jwtUtil.generateToken(user.getUsername(), user.getId(), tenantId,
                    user.getTokenVersion() == null ? 0 : user.getTokenVersion());

            recordLoginSuccess(reservation);
            return toAuthResponse(token, user, tenantId);
        } catch (RuntimeException ex) {
            recordLoginFailure(reservation);
            auditLoginFailure(auditTenantId, auditUserId, accountHash, clientIpHash);
            throw authenticationFailure();
        }
    }

    public AuthResponse register(RegisterRequest request) {
        // 公开请求不得通过 deptId 或任何客户端字段建立租户成员关系。
        // 受控用户创建由带 tenant-scoped 权限的 UserManagementService 承担。
        throw new AccessDeniedException("公开注册已关闭");
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean logout(String token) {
        if (token == null || token.isBlank()) {
            throw authenticationFailure();
        }
        try {
            String username = jwtUtil.getUsernameFromToken(token);
            Long userId = jwtUtil.getUserIdFromToken(token);
            String tenantId = jwtUtil.getTenantIdFromToken(token);
            Integer tokenVersion = jwtUtil.getTokenVersionFromToken(token);
            if (username == null || userId == null || tenantId == null || tokenVersion == null || tokenVersion < 0) {
                throw authenticationFailure();
            }
            User user = userMapper.selectOne(new LambdaQueryWrapper<User>()
                    .eq(User::getId, userId)
                    .eq(User::getUsername, username)
                    .eq(User::getTenantId, tenantId)
                    .eq(User::getStatus, 1)
                    .last("limit 1"));
            if (user == null || userTenantMembershipMapper.countActiveMembership(userId, tenantId) != 1
                    || !jwtUtil.validateToken(token, username, userId, tenantId,
                    user.getTokenVersion() == null ? 0 : user.getTokenVersion())) {
                throw authenticationFailure();
            }
            int version = user.getVersion() == null ? 0 : user.getVersion();
            user.setVersion(version + 1);
            user.setTokenVersion(tokenVersion + 1);
            int updated = userMapper.update(user, new LambdaUpdateWrapper<User>()
                    .eq(User::getId, userId)
                    .eq(User::getTenantId, tenantId)
                    .eq(User::getTokenVersion, tokenVersion)
                    .eq(User::getVersion, version));
            if (updated != 1) {
                throw authenticationFailure();
            }
            return true;
        } catch (AuthenticationException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw authenticationFailure();
        }
    }

    private AuthResponse toAuthResponse(String token, User user, String tenantId) {
        return new AuthResponse(
                token,
                user.getId(),
                user.getUsername(),
                user.getRealName(),
                safeCodes(userRoleMapper.selectRoleCodesByUserIdAndTenantId(user.getId(), tenantId)),
                safeCodes(userRoleMapper.selectPermissionCodesByUserIdAndTenantId(user.getId(), tenantId)),
                user.getPlatformAdmin());
    }

    private List<String> safeCodes(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return values.stream()
                .filter(value -> value != null && !value.isBlank())
                .toList();
    }

    private String resolveTenantId(User user) {
        if (user == null || user.getId() == null || user.getTenantId() == null || user.getTenantId().isBlank()) {
            throw authenticationFailure();
        }
        List<String> activeTenantIds = userTenantMembershipMapper.selectActiveTenantIdsByUserId(user.getId());
        if (activeTenantIds == null || activeTenantIds.size() != 1) {
            throw authenticationFailure();
        }
        String tenantId = activeTenantIds.get(0);
        if (tenantId == null || tenantId.isBlank() || !tenantId.equals(user.getTenantId())) {
            throw authenticationFailure();
        }
        SysTenant tenant = sysTenantMapper.selectById(tenantId);
        if (tenant == null || !"ACTIVE".equalsIgnoreCase(tenant.getStatus())) {
            throw authenticationFailure();
        }
        return tenant.getId();
    }

    private BadCredentialsException authenticationFailure() {
        return new BadCredentialsException(AUTHENTICATION_FAILURE_MESSAGE);
    }

    private LoginAttemptReservation reserveLoginAttempt(String accountHash, String clientIpHash) {
        try {
            return loginAttemptTracker.reserve(accountHash, clientIpHash).orElse(null);
        } catch (RuntimeException exception) {
            log.error("login_rate_limit_reserve_failed", exception);
            return null;
        }
    }

    private void recordLoginFailure(LoginAttemptReservation reservation) {
        try {
            loginAttemptTracker.recordFailure(reservation);
        } catch (RuntimeException exception) {
            log.error("login_rate_limit_record_failure_failed", exception);
        }
    }

    private void recordLoginSuccess(LoginAttemptReservation reservation) {
        try {
            loginAttemptTracker.recordSuccess(reservation);
        } catch (RuntimeException exception) {
            log.error("login_rate_limit_clear_failed", exception);
            throw authenticationFailure();
        }
    }

    private void auditLoginFailure(String tenantId, Long userId, String accountHash, String clientIpHash) {
        try {
            GeneralAuditEntry entry = new GeneralAuditEntry();
            entry.setTenantId(tenantId == null || tenantId.isBlank() ? UNAUTHENTICATED_AUDIT_TENANT : tenantId);
            entry.setTimestamp(LocalDateTime.now());
            entry.setCreatedAt(LocalDateTime.now());
            entry.setOperationType("AUTH_LOGIN");
            entry.setAction("login");
            entry.setResourceType("AUTHENTICATION");
            entry.setResourceId(accountHash);
            entry.setOperatorId(userId);
            entry.setDescription("登录认证失败");
            entry.setErrorMessage("AUTHENTICATION_FAILURE");
            entry.setStatus("FAILURE");
            entry.setIpAddress(clientIpHash);
            entry.setHttpMethod("POST");
            entry.setRequestUri("/auth/login");
            auditService.save(entry);
        } catch (RuntimeException exception) {
            log.warn("login_failure_audit_failed", exception);
        }
    }

    private String normalizeAccountKey(String username) {
        if (username == null || username.isBlank()) {
            return "invalid";
        }
        String normalized = username.trim().toLowerCase(Locale.ROOT);
        return normalized.length() <= 64 ? normalized : normalized.substring(0, 64);
    }

    private String normalizeClientIp(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            return "unknown";
        }
        String normalized = clientIp.trim();
        return normalized.length() <= 64 ? normalized : normalized.substring(0, 64);
    }

}
