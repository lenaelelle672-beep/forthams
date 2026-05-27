package com.ams.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 当前用户完整信息 DTO — 供 /api/auth/me 端点使用
 *
 * <p>从 LoginUser 填充，包含 userId/deptId/tenantId/username/realName/roles/permissions。</p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuthUserDTO {

    private Long userId;
    private Long deptId;
    private String tenantId;
    private String username;
    private String realName;
    private List<String> roles;
    private List<String> permissions;
}
