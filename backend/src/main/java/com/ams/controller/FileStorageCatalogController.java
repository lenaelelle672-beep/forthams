package com.ams.controller;

import com.ams.common.Result;
import com.ams.dto.FileStorageAttachmentCatalogDTO;
import com.ams.service.FileStorageCatalogService;
import com.ams.utils.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/system/file-storage/attachments")
@RequiredArgsConstructor
public class FileStorageCatalogController {

    private static final String PERMISSION_QUERY = "system:file-storage:query";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    private final FileStorageCatalogService fileStorageCatalogService;
    private final JwtUtil jwtUtil;

    @GetMapping("/catalog")
    public Result<FileStorageAttachmentCatalogDTO> getCatalog(
            HttpServletRequest request,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String businessType,
            @RequestParam(required = false) String fileType,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageSize
    ) {
        requirePermission(request);
        return Result.success(fileStorageCatalogService.getAttachmentCatalog(keyword, businessType, fileType, page, pageSize));
    }

    private Long requirePermission(HttpServletRequest request) {
        Long userId = requireCurrentUserId(request);
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("缺少文件存储附件目录查询权限");
        }
        if (hasPermission(authentication)) {
            return userId;
        }
        throw new AccessDeniedException("缺少文件存储附件目录查询权限");
    }

    private boolean hasPermission(Authentication authentication) {
        if (!authentication.isAuthenticated()) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority -> PERMISSION_QUERY.equals(authority) || ROLE_SUPER_ADMIN.equals(authority));
    }

    private Long requireCurrentUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AccessDeniedException("缺少文件存储附件目录查询权限");
        }
        Long userId = jwtUtil.getUserIdFromToken(authHeader.substring(7));
        if (userId == null) {
            throw new AccessDeniedException("缺少文件存储附件目录查询权限");
        }
        return userId;
    }
}
