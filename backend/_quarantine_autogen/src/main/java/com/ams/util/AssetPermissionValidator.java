// GENERATED - DO NOT MODIFY WITHOUT REVIEW
// Quarantined at: backend/_quarantine_autogen/src/main/java/com/ams/util/AssetPermissionValidator.java
// Status: QUARANTINED (Pending value assessment per SPEC-CONTEXT-SYNC-2026-04-22)
// Original line count: 223
// Review priority: P1 (Util class - medium priority)
// Recovery constraints: [C-003] Requires human review before restoration
// [C-004] Restoration only from commit history confirmed stable version

package com.ams.util;

import com.ams.entity.Asset;
import com.ams.entity.User;
import org.springframework.stereotype.Component;
import org.springframework.security.access.AccessDeniedException;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Set;
import java.util.HashSet;

/**
 * Asset Permission Validator
 * 
 * Quarantined file - pending value assessment per SPEC-CONTEXT-SYNC-2026-04-22
 * ATB-3.5: Code review for permission validation logic value
 * 
 * Assessment dimensions:
 * - Business logic completeness: Contains partial permission validation
 * - Code quality: Needs minor review for production use
 * - Recovery priority: P1
 * 
 * @deprecated Requires review before restoration to main codebase
 * @see com.ams.service.PermissionService
 */
@Component
public class AssetPermissionValidator {

    // Permission constants
    public static final String PERMISSION_VIEW = "ASSET_VIEW";
    public static final String PERMISSION_EDIT = "ASSET_EDIT";
    public static final String PERMISSION_DELETE = "ASSET_DELETE";
    public static final String PERMISSION_APPROVE = "ASSET_APPROVE";
    public static final String PERMISSION_TRANSFER = "ASSET_TRANSFER";
    public static final String PERMISSION_RETIRE = "ASSET_RETIRE";
    
    // Role-based permission mappings
    private static final Map<String, Set<String>> ROLE_PERMISSIONS = new HashMap<>();
    
    static {
        // Admin has all permissions
        Set<String> adminPerms = new HashSet<>(Arrays.asList(
            PERMISSION_VIEW, PERMISSION_EDIT, PERMISSION_DELETE,
            PERMISSION_APPROVE, PERMISSION_TRANSFER, PERMISSION_RETIRE
        ));
        ROLE_PERMISSIONS.put("ROLE_ADMIN", adminPerms);
        
        // Manager permissions
        Set<String> managerPerms = new HashSet<>(Arrays.asList(
            PERMISSION_VIEW, PERMISSION_EDIT, PERMISSION_APPROVE, PERMISSION_TRANSFER
        ));
        ROLE_PERMISSIONS.put("ROLE_MANAGER", managerPerms);
        
        // Operator permissions
        Set<String> operatorPerms = new HashSet<>(Arrays.asList(
            PERMISSION_VIEW, PERMISSION_EDIT
        ));
        ROLE_PERMISSIONS.put("ROLE_OPERATOR", operatorPerms);
        
        // Viewer permissions
        Set<String> viewerPerms = new HashSet<>(Arrays.asList(
            PERMISSION_VIEW
        ));
        ROLE_PERMISSIONS.put("ROLE_VIEWER", viewerPerms);
    }

    /**
     * Validates if user has permission to perform action on asset
     * 
     * @param user The user requesting access
     * @param asset The target asset
     * @param permission The required permission
     * @return true if user has permission
     */
    public boolean hasPermission(User user, Asset asset, String permission) {
        if (user == null || permission == null) {
            return false;
        }
        
        // Admin bypass
        if (user.hasRole("ROLE_ADMIN")) {
            return true;
        }
        
        // Check role-based permissions
        Set<String> userPermissions = getUserPermissions(user);
        if (userPermissions.contains(permission)) {
            // Additional asset-level check
            return validateAssetLevelAccess(user, asset, permission);
        }
        
        return false;
    }

    /**
     * Validates asset-level access based on ownership or department
     * 
     * @param user The requesting user
     * @param asset The target asset
     * @param permission The required permission
     * @return true if asset-level access is granted
     */
    private boolean validateAssetLevelAccess(User user, Asset asset, String permission) {
        if (asset == null) {
            return false;
        }
        
        // Owner check
        if (asset.getOwnerId() != null && asset.getOwnerId().equals(user.getId())) {
            return true;
        }
        
        // Department check for shared assets
        if (user.getDeptId() != null && asset.getDeptId() != null) {
            return user.getDeptId().equals(asset.getDeptId());
        }
        
        return false;
    }

    /**
     * Gets all permissions for a user based on their roles
     * 
     * @param user The user
     * @return Set of permission strings
     */
    private Set<String> getUserPermissions(User user) {
        Set<String> permissions = new HashSet<>();
        
        if (user == null || user.getRoles() == null) {
            return permissions;
        }
        
        for (String role : user.getRoles()) {
            Set<String> rolePerms = ROLE_PERMISSIONS.get(role);
            if (rolePerms != null) {
                permissions.addAll(rolePerms);
            }
        }
        
        return permissions;
    }

    /**
     * Validates batch operation permissions
     * 
     * @param user The requesting user
     * @param assets List of target assets
     * @param permission Required permission
     * @return ValidationResult with details
     */
    public ValidationResult validateBatchPermission(User user, List<Asset> assets, String permission) {
        ValidationResult result = new ValidationResult();
        
        if (assets == null || assets.isEmpty()) {
            result.setValid(true);
            return result;
        }
        
        int successCount = 0;
        List<String> failures = new java.util.ArrayList<>();
        
        for (Asset asset : assets) {
            if (hasPermission(user, asset, permission)) {
                successCount++;
            } else {
                failures.add("Asset " + asset.getId() + ": permission denied");
            }
        }
        
        result.setValid(failures.isEmpty());
        result.setSuccessCount(successCount);
        result.setFailureCount(failures.size());
        result.setFailures(failures);
        
        return result;
    }

    /**
     * Checks if user can approve retirement request
     * 
     * @param user The approving user
     * @param asset The asset being retired
     * @return true if user can approve
     */
    public boolean canApproveRetirement(User user, Asset asset) {
        if (!hasPermission(user, asset, PERMISSION_APPROVE)) {
            return false;
        }
        
        // Additional retirement-specific rules
        if (user.hasRole("ROLE_ADMIN") || user.hasRole("ROLE_MANAGER")) {
            return true;
        }
        
        // Department head can approve within department
        return user.isDeptHead() && user.getDeptId().equals(asset.getDeptId());
    }

    /**
     * Validates asset transfer permissions
     * 
     * @param user The requesting user
     * @param asset The asset to transfer
     * @param targetDeptId Target department ID
     * @return true if transfer is allowed
     */
    public boolean canTransferAsset(User user, Asset asset, Long targetDeptId) {
        if (!hasPermission(user, asset, PERMISSION_TRANSFER)) {
            return false;
        }
        
        // Cannot transfer to same department
        if (asset.getDeptId() != null && asset.getDeptId().equals(targetDeptId)) {
            return false;
        }
        
        // Only admin or manager can transfer
        return user.hasRole("ROLE_ADMIN") || user.hasRole("ROLE_MANAGER");
    }

    /**
     * Inner class for batch validation results
     */
    public static class ValidationResult {
        private boolean valid;
        private int successCount;
        private int failureCount;
        private List<String> failures;
        
        public boolean isValid() {
            return valid;
        }
        
        public void setValid(boolean valid) {
            this.valid = valid;
        }
        
        public int getSuccessCount() {
            return successCount;
        }
        
        public void setSuccessCount(int successCount) {
            this.successCount = successCount;
        }
        
        public int getFailureCount() {
            return failureCount;
        }
        
        public void setFailureCount(int failureCount) {
            this.failureCount = failureCount;
        }
        
        public List<String> getFailures() {
            return failures;
        }
        
        public void setFailures(List<String> failures) {
            this.failures = failures;
        }
    }
}