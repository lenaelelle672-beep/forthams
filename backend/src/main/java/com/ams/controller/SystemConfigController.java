package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.SystemConfigDTO;
import com.ams.dto.SystemConfigOperationDTO;
import com.ams.dto.SystemConfigPreviewDTO;
import com.ams.dto.SystemConfigRefreshResultDTO;
import com.ams.dto.SystemConfigSaveDTO;
import com.ams.service.SystemConfigService;
import com.ams.utils.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@RestController
@RequiredArgsConstructor
public class SystemConfigController {

    private static final String GROUP_SYSTEM = "SYSTEM";
    private static final String GROUP_SECURITY = "SECURITY";
    private static final String PERMISSION_QUERY = "system:config:query";
    private static final String PERMISSION_EDIT = "system:config:edit";
    private static final String PERMISSION_DELETE = "system:config:delete";
    private static final String PERMISSION_PREVIEW = "system:config:preview";
    private static final String PERMISSION_REFRESH = "system:config:refresh";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final SystemConfigService systemConfigService;
    private final JwtUtil jwtUtil;

    @GetMapping("/system-config/system")
    public Result<Map<String, String>> getSystemConfig(HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(systemConfigService.getGroupConfig(GROUP_SYSTEM));
    }

    @PutMapping("/system-config/system")
    public Result<Map<String, String>> saveSystemConfig(@RequestBody Map<String, Object> body,
                                                        HttpServletRequest request) {
        Long currentUserId = requirePermission(request, PERMISSION_EDIT);
        return Result.success(systemConfigService.saveGroupConfig(GROUP_SYSTEM, toGroupSaveDTO(body), currentUserId));
    }

    @PostMapping("/system-config/system/preview")
    public Result<SystemConfigPreviewDTO> previewSystemConfig(@RequestBody Map<String, Object> body,
                                                             HttpServletRequest request) {
        requirePermission(request, PERMISSION_PREVIEW);
        return Result.success(systemConfigService.preview(GROUP_SYSTEM, toGroupSaveDTO(body)));
    }

    @GetMapping("/system-config/security")
    public Result<Map<String, String>> getSecurityConfig(HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(systemConfigService.getGroupConfig(GROUP_SECURITY));
    }

    @PutMapping("/system-config/security")
    public Result<Map<String, String>> saveSecurityConfig(@RequestBody Map<String, Object> body,
                                                           HttpServletRequest request) {
        Long currentUserId = requirePermission(request, PERMISSION_EDIT);
        return Result.success(systemConfigService.saveGroupConfig(GROUP_SECURITY, toGroupSaveDTO(body), currentUserId));
    }

    @PostMapping("/system-config/security/preview")
    public Result<SystemConfigPreviewDTO> previewSecurityConfig(@RequestBody Map<String, Object> body,
                                                               HttpServletRequest request) {
        requirePermission(request, PERMISSION_PREVIEW);
        return Result.success(systemConfigService.previewSecurity(toGroupSaveDTO(body)));
    }

    @GetMapping("/system/configs")
    public Result<Map<String, Object>> listConfigs(@RequestParam(required = false) Integer page,
                                                   @RequestParam(required = false) Integer pageSize,
                                                   @RequestParam(required = false) String configName,
                                                   @RequestParam(required = false) String configKey,
                                                   @RequestParam(required = false) String configGroup,
                                                   HttpServletRequest request) {
        requirePermission(request, PERMISSION_QUERY);
        return Result.success(systemConfigService.listConfigs(page, pageSize, configName, configKey, configGroup));
    }

    @PostMapping("/system/configs")
    public Result<SystemConfigDTO> createConfig(@RequestBody SystemConfigSaveDTO body,
                                                HttpServletRequest request) {
        Long currentUserId = requirePermission(request, PERMISSION_EDIT);
        return Result.success(systemConfigService.create(body, currentUserId));
    }

    @PutMapping("/system/configs/{id}")
    public Result<SystemConfigDTO> updateConfig(@PathVariable Long id,
                                                @RequestBody SystemConfigSaveDTO body,
                                                HttpServletRequest request) {
        Long currentUserId = requirePermission(request, PERMISSION_EDIT);
        return Result.success(systemConfigService.update(id, body, currentUserId));
    }

    @DeleteMapping("/system/configs/{id}")
    public Result<Void> deleteConfig(@PathVariable Long id,
                                     @RequestBody(required = false) SystemConfigOperationDTO body,
                                     HttpServletRequest request) {
        Long currentUserId = requirePermission(request, PERMISSION_DELETE);
        systemConfigService.delete(id, body, currentUserId);
        return Result.success();
    }

    @PostMapping("/system/configs/preview")
    public Result<SystemConfigPreviewDTO> previewConfig(@RequestBody SystemConfigSaveDTO body,
                                                        HttpServletRequest request) {
        requirePermission(request, PERMISSION_PREVIEW);
        return Result.success(systemConfigService.preview(GROUP_SYSTEM, body));
    }

    @PostMapping("/system/configs/refresh-cache")
    public Result<SystemConfigRefreshResultDTO> refreshCache(@RequestBody(required = false) SystemConfigOperationDTO body,
                                                             HttpServletRequest request) {
        Long currentUserId = requirePermission(request, PERMISSION_REFRESH);
        return Result.success(systemConfigService.refreshCache(body, currentUserId));
    }

    private Long requirePermission(HttpServletRequest request, String permission) {
        Long userId = requireCurrentUserId(request);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("缺少系统参数权限: " + permission);
        }
        if (hasPermission(authentication, permission)) {
            return userId;
        }
        throw new AccessDeniedException("缺少系统参数权限: " + permission);
    }

    private boolean hasPermission(Authentication authentication, String permission) {
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority -> permission.equals(authority) || ROLE_SUPER_ADMIN.equals(authority));
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AccessDeniedException("缺少系统参数登录态");
        }
        Long userId;
        try {
            userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        } catch (Exception e) {
            throw new AccessDeniedException("缺少系统参数登录态");
        }
        if (userId == null) {
            throw new AccessDeniedException("缺少系统参数登录态");
        }
        return userId;
    }

    private SystemConfigSaveDTO toGroupSaveDTO(Map<String, Object> body) {
        Map<String, Object> source = body == null ? Map.of() : body;
        SystemConfigSaveDTO dto = new SystemConfigSaveDTO();
        dto.setOperatorId(toLong(source.get("operatorId")));
        dto.setReason(toStringValue(source.get("reason")));
        dto.setAuditEvidence(toStringValue(source.get("auditEvidence")));
        dto.setConfirmed(toBoolean(source.get("confirmed")));
        dto.setConfigType(toStringValue(source.get("configType")));
        Object configs = source.get("configs");
        if (configs instanceof Map<?, ?> configMap) {
            dto.setConfigs(toStringMap(configMap));
        } else {
            dto.setConfigs(extractLegacyConfigMap(source));
        }
        return dto;
    }

    private Map<String, String> extractLegacyConfigMap(Map<String, Object> source) {
        Map<String, String> result = new LinkedHashMap<>();
        for (Map.Entry<String, Object> entry : source.entrySet()) {
            if (Set.of("operatorId", "reason", "auditEvidence", "confirmed", "configType", "configs", "tenantId", "configGroup", "namespaces").contains(entry.getKey())) {
                continue;
            }
            result.put(entry.getKey(), toStringValue(entry.getValue()));
        }
        return result;
    }

    private Map<String, String> toStringMap(Map<?, ?> source) {
        Map<String, String> result = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : source.entrySet()) {
            if (entry.getKey() != null) {
                result.put(String.valueOf(entry.getKey()), toStringValue(entry.getValue()));
            }
        }
        return result;
    }

    private String toStringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Long toLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value == null) {
            return null;
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Boolean toBoolean(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value == null) {
            return null;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }
}
