package com.ams.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
public class AuthResponse {

    private String token;
    private Long userId;
    private String username;
    private String realName;
    private List<String> roles;
    private List<String> permissions;
    private Boolean platformAdmin;

    public AuthResponse(String token, Long userId, String username, String realName) {
        this(token, userId, username, realName, List.of(), List.of(), Boolean.FALSE);
    }

    public AuthResponse(String token, Long userId, String username, String realName,
                        List<String> roles, List<String> permissions, Boolean platformAdmin) {
        this.token = token;
        this.userId = userId;
        this.username = username;
        this.realName = realName;
        this.roles = roles == null ? List.of() : List.copyOf(roles);
        this.permissions = permissions == null ? List.of() : List.copyOf(permissions);
        this.platformAdmin = Boolean.TRUE.equals(platformAdmin);
    }
}
