package com.ams.controller;

import com.ams.annotation.OperBusinessType;
import com.ams.annotation.OperLog;
import com.ams.common.Result;
import com.ams.entity.SysMenu;
import com.ams.mapper.SysMenuMapper;
import com.ams.security.LoginUser;
import com.ams.service.SysMenuService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 菜单权限管理 Controller
 *
 * <p>提供菜单树查询、管理后台菜单 CRUD 接口。
 * /menus/current 返回当前登录用户可见的菜单树，供前端动态渲染侧边栏。
 * 管理后台接口统一移至 /menus/admin 前缀下，与 MenuController 分离避免路由冲突。</p>
 */
@RestController
@RequestMapping("/menus")
@RequiredArgsConstructor
public class SysMenuController {

    private final SysMenuService sysMenuService;
    private final SysMenuMapper sysMenuMapper;

    /**
     * 获取当前登录用户可见的菜单树、权限码和角色。
     */
    @GetMapping("/current")
    public Result<Map<String, Object>> currentUserMenus() {
        LoginUser loginUser = getLoginUser();
        Long userId = loginUser.getUserId();
        List<SysMenu> menus = sysMenuService.getCurrentUserMenuTree(userId);
        List<String> permissions = sysMenuMapper.selectPermsByUserId(userId);
        List<String> roles = loginUser.getRoles();

        Map<String, Object> result = new HashMap<>();
        result.put("menus", menus);
        result.put("permissions", permissions);
        result.put("roles", roles);
        return Result.success(result);
    }

    /** 管理后台：获取所有菜单平铺列表 */
    @GetMapping("/admin")
    @PreAuthorize("@ss.hasPermi('system:menu:list')")
    public Result<List<SysMenu>> list() {
        return Result.success(sysMenuService.listAll());
    }

    /** 管理后台：获取菜单树 */
    @GetMapping("/admin/tree")
    @PreAuthorize("@ss.hasPermi('system:menu:list')")
    public Result<List<SysMenu>> tree() {
        List<SysMenu> all = sysMenuService.listAll();
        return Result.success(sysMenuService.buildMenuTree(all));
    }

    /** 管理后台：获取单个菜单 */
    @GetMapping("/admin/{id}")
    @PreAuthorize("@ss.hasPermi('system:menu:query')")
    public Result<SysMenu> getById(@PathVariable Long id) {
        return Result.success(sysMenuService.getById(id));
    }

    /** 管理后台：创建菜单 */
    @PostMapping("/admin")
    @PreAuthorize("@ss.hasPermi('system:menu:add')")
    @OperLog(title = "菜单新增", businessType = OperBusinessType.INSERT)
    public Result<SysMenu> create(@RequestBody SysMenu menu) {
        return Result.success(sysMenuService.create(menu));
    }

    /** 管理后台：更新菜单 */
    @PutMapping("/admin/{id}")
    @PreAuthorize("@ss.hasPermi('system:menu:edit')")
    @OperLog(title = "菜单修改", businessType = OperBusinessType.UPDATE)
    public Result<SysMenu> update(@PathVariable Long id, @RequestBody SysMenu menu) {
        return Result.success(sysMenuService.update(id, menu));
    }

    /** 管理后台：删除菜单 */
    @DeleteMapping("/admin/{id}")
    @PreAuthorize("@ss.hasPermi('system:menu:delete')")
    @OperLog(title = "菜单删除", businessType = OperBusinessType.DELETE)
    public Result<Void> delete(@PathVariable Long id) {
        sysMenuService.delete(id);
        return Result.success(null);
    }

    private LoginUser getLoginUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof LoginUser loginUser) {
            return loginUser;
        }
        throw new IllegalStateException("未登录或认证信息无效");
    }
}
