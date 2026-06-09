package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.AuthResponse;
import com.ams.dto.RegisterRequest;
import com.ams.dto.ResetPasswordRequest;
import com.ams.entity.User;
import com.ams.mapper.SysMenuMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.security.SecurityUserCacheService;
import com.ams.utils.JwtUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("认证服务测试")
class AuthServiceTest {

    @Mock
    private UserMapper userMapper;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtUtil jwtUtil;
    @Mock
    private AuthenticationManager authenticationManager;
    @Mock
    private UserRoleMapper userRoleMapper;
    @Mock
    private SysMenuMapper sysMenuMapper;
    @Mock
    private SecurityUserCacheService securityUserCacheService;

    @InjectMocks
    private AuthService authService;

    @Test
    @DisplayName("默认关闭自助注册")
    void registerRejectsSelfRegistrationWhenDisabled() {
        RegisterRequest request = registerRequest("newuser");

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("系统未开放自助注册");

        verify(userMapper, never()).selectOne(any());
        verify(userMapper, never()).insert(any(User.class));
    }

    @Test
    @DisplayName("开启自助注册时仍拒绝客户端指定部门")
    void registerRejectsClientProvidedDeptId() {
        enableRegistration("1");
        RegisterRequest request = registerRequest("newuser");
        request.setDeptId(2L);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("自助注册不允许指定部门");

        verify(userMapper, never()).selectOne(any());
        verify(userMapper, never()).insert(any(User.class));
    }

    @Test
    @DisplayName("自助注册使用服务端默认部门生成租户令牌")
    void registerUsesServerDefaultDeptForTenantToken() {
        enableRegistration("7");
        RegisterRequest request = registerRequest("newuser");
        when(userMapper.selectOne(any())).thenReturn(null);
        when(passwordEncoder.encode("pass123")).thenReturn("encoded-pass");
        when(userMapper.insert(any(User.class))).thenAnswer(invocation -> {
            User inserted = invocation.getArgument(0);
            inserted.setId(9L);
            return 1;
        });
        when(jwtUtil.generateToken("newuser", 9L, "dept:7")).thenReturn("reg-token");
        when(userRoleMapper.selectRoleCodesByUserId(9L)).thenReturn(List.of("USER"));
        when(sysMenuMapper.selectPermsByUserId(9L)).thenReturn(List.of("dashboard:view"));

        AuthResponse response = authService.register(request);

        assertThat(response.getToken()).isEqualTo("reg-token");
        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userMapper).insert(captor.capture());
        assertThat(captor.getValue().getDeptId()).isEqualTo(7L);
        verify(jwtUtil).generateToken(eq("newuser"), eq(9L), eq("dept:7"));
    }

    @Test
    @DisplayName("重复用户名注册抛出冲突异常")
    void registerRejectsDuplicateUsername() {
        enableRegistration("1");
        User existingUser = user("admin", "encoded-old");
        when(userMapper.selectOne(any())).thenReturn(existingUser);

        RegisterRequest request = registerRequest("admin");

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("用户名已存在");

        verify(userMapper, never()).insert(any(User.class));
    }

    @Test
    @DisplayName("仅 username 和新密码不能重置密码")
    void resetPasswordRejectsMissingOldPassword() {
        User user = user("admin", "encoded-old");
        when(userMapper.selectOne(any())).thenReturn(user);
        ResetPasswordRequest request = request("admin", null, "newPass123");

        assertThatThrownBy(() -> authService.resetPassword(request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("旧密码不能为空");

        verify(userMapper, never()).updateById(any(User.class));
    }

    @Test
    @DisplayName("旧密码错误不能重置密码")
    void resetPasswordRejectsWrongOldPassword() {
        User user = user("admin", "encoded-old");
        when(userMapper.selectOne(any())).thenReturn(user);
        when(passwordEncoder.matches("wrong", "encoded-old")).thenReturn(false);

        assertThatThrownBy(() -> authService.resetPassword(request("admin", "wrong", "newPass123")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("旧密码不正确");

        verify(userMapper, never()).updateById(any(User.class));
    }

    @Test
    @DisplayName("密码重置成功后更新密码并清理用户缓存")
    void resetPasswordUpdatesPasswordAndEvictsCache() {
        User user = user("admin", "encoded-old");
        when(userMapper.selectOne(any())).thenReturn(user);
        when(passwordEncoder.matches("oldPass123", "encoded-old")).thenReturn(true);
        when(passwordEncoder.encode("newPass123")).thenReturn("encoded-new");

        authService.resetPassword(request("admin", "oldPass123", "newPass123"));

        verify(userMapper).updateById(user);
        verify(securityUserCacheService).evictByUsername("admin");
    }

    private ResetPasswordRequest request(String username, String oldPassword, String newPassword) {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setUsername(username);
        request.setOldPassword(oldPassword);
        request.setNewPassword(newPassword);
        return request;
    }

    private RegisterRequest registerRequest(String username) {
        RegisterRequest request = new RegisterRequest();
        request.setUsername(username);
        request.setPassword("pass123");
        request.setRealName("管理员");
        return request;
    }

    private void enableRegistration(String defaultDeptId) {
        ReflectionTestUtils.setField(authService, "registrationEnabled", true);
        ReflectionTestUtils.setField(authService, "registrationDefaultDeptId", defaultDeptId);
    }

    private User user(String username, String password) {
        User user = new User();
        user.setId(1L);
        user.setUsername(username);
        user.setPassword(password);
        user.setDeptId(1L);
        user.setStatus(1);
        return user;
    }
}
