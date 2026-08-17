package com.ams.service;

import com.ams.context.TenantContext;
import com.ams.entity.Location;
import com.ams.mapper.LocationMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LocationService {

    private static final String LOCATION_QUERY_PERMISSION = "location:query";

    private final LocationMapper locationMapper;
    private final TenantAuthorityService tenantAuthorityService;

    public Location findById(Long id) {
        requireQueryPermission();
        return locationMapper.findById(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public void insert(Location location) {
        tenantAuthorityService.requirePlatformAdmin();
        locationMapper.insert(location);
    }

    @Transactional(rollbackFor = Exception.class)
    public void update(Location location) {
        tenantAuthorityService.requirePlatformAdmin();
        locationMapper.update(location);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteById(Long id) {
        tenantAuthorityService.requirePlatformAdmin();
        locationMapper.deleteById(id);
    }

    public List<Location> findLocationHierarchy(Long id) {
        requireQueryPermission();
        return locationMapper.findLocationHierarchy(id);
    }

    public List<Location> findRootLocations() {
        requireQueryPermission();
        return locationMapper.findRootLocations();
    }

    public List<Location> findChildrenByParentId(Long parentId) {
        requireQueryPermission();
        return locationMapper.findChildrenByParentId(parentId);
    }

    public List<Location> findDescendants(Long id) {
        requireQueryPermission();
        return locationMapper.findDescendants(id);
    }

    private void requireQueryPermission() {
        TenantContext.requireTenantId();
        if (!hasPermission(LOCATION_QUERY_PERMISSION)) {
            throw new AccessDeniedException("缺少位置查询权限");
        }
    }

    private boolean hasPermission(String permission) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null
                && !(authentication instanceof AnonymousAuthenticationToken)
                && authentication.isAuthenticated()
                && authentication.getAuthorities().stream()
                .anyMatch(authority -> permission.equals(authority.getAuthority()));
    }
}
