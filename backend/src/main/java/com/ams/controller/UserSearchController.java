package com.ams.controller;

import com.ams.common.Result;
import com.ams.context.TenantContext;
import com.ams.entity.User;
import com.ams.service.AssetService;
import com.ams.service.UserManagementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 用户搜索控制器
 *
 * <p>提供用户搜索接口，主要用于评论 @mention 自动补全功能。
 * 租户过滤：通过当前租户的资产数据获取部门ID列表，然后过滤用户。</p>
 */
@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
@Tag(name = "用户搜索", description = "用户搜索接口，用于 @mention 自动补全")
public class UserSearchController {

    private final UserManagementService userManagementService;
    private final AssetService assetService;

    /**
     * 搜索用户（用于 @mention 自动补全）
     *
     * <p>根据关键词搜索用户，支持用户名、真实姓名、邮箱、电话匹配。
     * 租户过滤：通过当前租户的资产数据获取部门ID列表，只返回这些部门的用户。
     * 返回状态为 1（正常）的用户，最多返回 50 条记录。</p>
     *
     * @param keyword 搜索关键词（可选）
     * @return 用户列表
     */
    @Operation(summary = "搜索用户", description = "根据关键词搜索用户，用于 @mention 自动补全，带租户过滤")
    @GetMapping("/search")
    public Result<List<User>> searchUsers(@RequestParam(required = false) String keyword) {
        // 获取当前租户ID
        String tenantId = TenantContext.requireTenantId();

        // 获取当前租户的部门ID列表（通过资产数据获取）
        List<Long> deptIds = assetService.getDeptIdsByTenant(tenantId);

        // 如果没有部门数据，返回空列表
        if (deptIds == null || deptIds.isEmpty()) {
            return Result.success(List.of());
        }

        // 根据部门ID列表搜索用户
        List<User> users = userManagementService.searchUsersByDepts(keyword, deptIds);
        return Result.success(users);
    }
}