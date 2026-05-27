package com.ams.controller;

import com.ams.annotation.OperBusinessType;
import com.ams.annotation.OperLog;
import com.ams.dto.RoleCreateDTO;
import com.ams.dto.RoleUpdateDTO;
import com.ams.entity.Role;
import com.ams.service.RoleService;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.ams.common.Result;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 角色管理 Controller — 对应 /api/roles
 *
 * <p>增删改接口受 @PreAuthorize("@ss.hasPermi(...)") 保护。
 * 由原 RoleController 重命名而来，补充权限注解和管理端点。</p>
 */
@RestController
@RequestMapping("/roles")
@RequiredArgsConstructor
public class RoleManagementController {

    private final RoleService roleService;

    @GetMapping("/list")
    @PreAuthorize("@ss.hasPermi('system:role:query')")
    public Result<Page<Role>> list(
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer pageSize) {
        return Result.success(roleService.queryRoles(page, pageSize, null));
    }

    @GetMapping("/all")
    public Result<List<Role>> all() {
        return Result.success(roleService.listAllRoles());
    }

    @GetMapping("/{id}")
    @PreAuthorize("@ss.hasPermi('system:role:query')")
    public Result<Role> getById(@PathVariable Long id) {
        return Result.success(roleService.getRoleById(id));
    }

    @PostMapping
    @PreAuthorize("@ss.hasPermi('system:role:add')")
    @OperLog(title = "角色新增", businessType = OperBusinessType.INSERT)
    public Result<Role> create(@Valid @RequestBody RoleCreateDTO dto) {
        return Result.success(roleService.createRole(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("@ss.hasPermi('system:role:edit')")
    @OperLog(title = "角色修改", businessType = OperBusinessType.UPDATE)
    public Result<Role> update(@PathVariable Long id, @Valid @RequestBody RoleUpdateDTO dto) {
        return Result.success(roleService.updateRole(id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@ss.hasPermi('system:role:delete')")
    @OperLog(title = "角色删除", businessType = OperBusinessType.DELETE)
    public Result<Void> delete(@PathVariable Long id) {
        roleService.deleteRole(id);
        return Result.success();
    }

    /** 分配角色菜单权限 */
    @PreAuthorize("@ss.hasPermi('system:role:edit')")
    @PutMapping("/{id}/menus")
    @OperLog(title = "角色菜单授权", businessType = OperBusinessType.GRANT)
    public Result<Void> assignMenus(@PathVariable Long id, @RequestBody Map<String, List<Long>> body) {
        List<Long> menuIds = body.get("menuIds");
        roleService.assignMenus(id, menuIds);
        return Result.success();
    }

    /** 分配角色部门数据权限 */
    @PreAuthorize("@ss.hasPermi('system:role:edit')")
    @PutMapping("/{id}/depts")
    @OperLog(title = "角色数据权限", businessType = OperBusinessType.GRANT)
    public Result<Void> assignDepts(@PathVariable Long id, @RequestBody Map<String, List<Long>> body) {
        List<Long> deptIds = body.get("deptIds");
        roleService.assignDepts(id, deptIds);
        return Result.success();
    }
}
