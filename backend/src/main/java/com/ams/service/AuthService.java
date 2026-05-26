package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.AuthResponse;
import com.ams.dto.LoginRequest;
import com.ams.dto.RegisterRequest;
import com.ams.dto.ResetPasswordRequest;
import com.ams.entity.User;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.ams.utils.JwtUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    private final UserRoleMapper userRoleMapper;

    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );

        User user = userMapper.selectOne(
            new LambdaQueryWrapper<User>().eq(User::getUsername, request.getUsername())
        );

        String token = jwtUtil.generateToken(user.getUsername(), user.getId(), resolveTenantId(user));
        List<String> roles = userRoleMapper.selectRoleCodesByUserId(user.getId());

        return new AuthResponse(token, user.getId(), user.getUsername(), user.getRealName(), roles);
    }

    @Transactional(rollbackFor = Exception.class)
    public AuthResponse register(RegisterRequest request) {
        User existingUser = userMapper.selectOne(
            new LambdaQueryWrapper<User>().eq(User::getUsername, request.getUsername())
        );

        if (existingUser != null) {
            throw new BusinessException("用户名已存在");
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRealName(request.getRealName());
        user.setEmail(request.getEmail());
        user.setPhone(request.getPhone());
        user.setDeptId(request.getDeptId());
        user.setStatus(1);

        userMapper.insert(user);

        String token = jwtUtil.generateToken(user.getUsername(), user.getId(), resolveTenantId(user));
        List<String> roles = userRoleMapper.selectRoleCodesByUserId(user.getId());

        return new AuthResponse(token, user.getId(), user.getUsername(), user.getRealName(), roles);
    }

    public boolean logout() {
        return true;
    }

    @Transactional(rollbackFor = Exception.class)
    public void resetPassword(ResetPasswordRequest request) {
        User user = userMapper.selectOne(
            new LambdaQueryWrapper<User>().eq(User::getUsername, request.getUsername())
        );
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            throw new BusinessException("旧密码不正确");
        }
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userMapper.updateById(user);
    }

    private String resolveTenantId(User user) {
        if (user.getDeptId() == null) {
            throw new BusinessException("用户未绑定部门，无法生成租户令牌");
        }
        return "dept:" + user.getDeptId();
    }

}
