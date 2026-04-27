package com.ams.service;

import com.ams.entity.User;
import com.ams.entity.UserRole;
import com.ams.common.exception.BusinessException;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

/**
 * 权限校验服务
 * 
 * <p>负责资产报废退役流程中的权限校验，包括：
 * <ul>
 *   <li>报废申请发起权限校验</li>
 *   <li>审批流程权限校验</li>
 *   <li>申请人与审批人分离校验</li>
 *   <li>角色访问控制</li>
 * </ul>
 * 
 * @see UserRole
 * @since SWARM-002
 */
@Service
public class PermissionService {

    /**
     * 可发起报废申请的角色列表
     */
    private static final List<UserRole> ALLOWED_REQUESTER_ROLES = Arrays.asList(
        UserRole.ADMIN,
        UserRole.ASSET_MANAGER
    );

    /**
     * 可执行审批的角色列表
     */
    private static final List<UserRole> ALLOWED_APPROVER_ROLES = Arrays.asList(
        UserRole.ADMIN,
        UserRole.ASSET_MANAGER
    );

    /**
     * 校验用户是否有权发起资产报废申请
     * 
     * <p>根据 SWARM-002 规格，仅资产责任人（owner）或管理员（admin）角色可发起报废申请</p>
     * 
     * @param user 申请用户
     * @throws BusinessException 如果用户无权发起申请，返回 PERMISSION_DENIED
     */
    public void validateRetirementRequestPermission(User user) {
        if (user == null) {
            throw new BusinessException("用户信息不能为空", "INVALID_USER");
        }
        
        UserRole role = user.getRole();
        if (role == null) {
            throw new BusinessException("用户角色不能为空", "INVALID_USER_ROLE");
        }
        
        if (!ALLOWED_REQUESTER_ROLES.contains(role)) {
            throw new BusinessException(
                "用户 [" + user.getUsername() + "] 无权发起报废申请，需要 " + 
                ALLOWED_REQUESTER_ROLES + " 角色之一",
                "PERMISSION_DENIED"
            );
        }
    }

    /**
     * 校验审批人是否有权执行审批操作
     * 
     * @param approver 审批用户
     * @throws BusinessException 如果审批人无权执行审批
     */
    public void validateApprovalPermission(User approver) {
        if (approver == null) {
            throw new BusinessException("审批人信息不能为空", "INVALID_APPROVER");
        }
        
        UserRole role = approver.getRole();
        if (role == null) {
            throw new BusinessException("审批人角色不能为空", "INVALID_APPROVER_ROLE");
        }
        
        if (!ALLOWED_APPROVER_ROLES.contains(role)) {
            throw new BusinessException(
                "用户 [" + approver.getUsername() + "] 无权执行审批，需要 " + 
                ALLOWED_APPROVER_ROLES + " 角色之一",
                "APPROVAL_PERMISSION_DENIED"
            );
        }
    }

    /**
     * 校验申请人与审批人不得为同一用户
     * 
     * <p>根据合规边界要求，申请人不得审批自己创建的申请</p>
     * 
     * @param requesterId 申请人ID
     * @param approverId 审批人ID
     * @throws BusinessException 如果申请人与审批人为同一用户
     */
    public void validateRequesterApproverSeparation(String requesterId, String approverId) {
        if (requesterId == null || approverId == null) {
            throw new BusinessException("申请人ID和审批人ID不能为空", "INVALID_ID");
        }
        
        if (requesterId.equals(approverId)) {
            throw new BusinessException(
                "申请人不能审批自己创建的申请",
                "APPROVAL_SELF_FORBIDDEN"
            );
        }
    }

    /**
     * 校验用户是否为资产责任人
     * 
     * @param user 目标用户
     * @param assetOwnerId 资产责任人ID
     * @return true 如果用户是资产责任人
     */
    public boolean isAssetOwner(User user, String assetOwnerId) {
        if (user == null || assetOwnerId == null) {
            return false;
        }
        return user.getId().equals(assetOwnerId);
    }

    /**
     * 校验用户是否有权限访问指定资产
     * 
     * <p>ADMIN 和 ASSET_MANAGER 可访问所有资产，普通用户仅能访问自己负责的资产</p>
     * 
     * @param user 目标用户
     * @param assetOwnerId 资产责任人ID
     * @return true 如果用户有权限访问
     */
    public boolean canAccessAsset(User user, String assetOwnerId) {
        if (user == null) {
            return false;
        }
        
        UserRole role = user.getRole();
        if (role == UserRole.ADMIN || role == UserRole.ASSET_MANAGER) {
            return true;
        }
        
        return isAssetOwner(user, assetOwnerId);
    }

    /**
     * 检查用户是否为管理员角色
     * 
     * @param user 目标用户
     * @return true 如果用户是管理员
     */
    public boolean isAdmin(User user) {
        return user != null && user.getRole() == UserRole.ADMIN;
    }

    /**
     * 检查用户是否为资产管理员角色
     * 
     * @param user 目标用户
     * @return true 如果用户是资产管理员
     */
    public boolean isAssetManager(User user) {
        return user != null && user.getRole() == UserRole.ASSET_MANAGER;
    }

    /**
     * 获取用户可执行的操作列表
     * 
     * @param user 目标用户
     * @return 可执行操作列表
     */
    public List<String> getAvailableOperations(User user) {
        if (user == null) {
            return List.of();
        }
        
        UserRole role = user.getRole();
        switch (role) {
            case ADMIN:
                return Arrays.asList(
                    "CREATE_RETIREMENT",
                    "APPROVE_RETIREMENT",
                    "REJECT_RETIREMENT",
                    "DISPOSE_ASSET",
                    "VIEW_ALL_RECORDS",
                    "EXPORT_REPORT"
                );
            case ASSET_MANAGER:
                return Arrays.asList(
                    "CREATE_RETIREMENT",
                    "APPROVE_RETIREMENT",
                    "REJECT_RETIREMENT",
                    "VIEW_ALL_RECORDS"
                );
            case REQUESTER:
                return Arrays.asList(
                    "VIEW_OWN_RECORDS"
                );
            default:
                return List.of();
        }
    }
}