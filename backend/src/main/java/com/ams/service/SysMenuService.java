package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.entity.SysMenu;
import com.ams.mapper.SysMenuMapper;
import com.ams.security.SecurityUserCacheService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 菜单权限服务
 *
 * <p>负责菜单树构建、用户菜单查询、菜单 CRUD 操作。
 * 菜单树构建参考 RuoYi 递归模型，不依赖 Entity 层 children 字段。</p>
 */
@Service
public class SysMenuService {

    private final SysMenuMapper sysMenuMapper;
    private final SecurityUserCacheService securityUserCacheService;

    public SysMenuService(SysMenuMapper sysMenuMapper, SecurityUserCacheService securityUserCacheService) {
        this.sysMenuMapper = sysMenuMapper;
        this.securityUserCacheService = securityUserCacheService;
    }

    /**
     * 获取当前登录用户可见的菜单树（目录 + 菜单类型，不含按钮）。
     */
    public List<SysMenu> getCurrentUserMenuTree(Long userId) {
        List<SysMenu> allMenus = sysMenuMapper.selectMenuTreeByUserId(userId);
        return buildMenuTree(allMenus);
    }

    /**
     * 递归构建菜单树。
     */
    public List<SysMenu> buildMenuTree(List<SysMenu> menuList) {
        if (menuList == null || menuList.isEmpty()) {
            return new ArrayList<>();
        }

        Map<Long, List<SysMenu>> childrenMap = menuList.stream()
                .collect(Collectors.groupingBy(m -> m.getParentId() != null ? m.getParentId() : 0L));

        for (SysMenu menu : menuList) {
            List<SysMenu> children = childrenMap.getOrDefault(menu.getId(), new ArrayList<>());
            children.sort(Comparator.comparingInt(m -> m.getSortOrder() != null ? m.getSortOrder() : 0));
            menu.setChildren(children.isEmpty() ? null : children);
        }

        List<SysMenu> rootMenus = childrenMap.getOrDefault(0L, new ArrayList<>());
        rootMenus.sort(Comparator.comparingInt(m -> m.getSortOrder() != null ? m.getSortOrder() : 0));
        return rootMenus;
    }

    /** 获取所有菜单平铺列表 */
    public List<SysMenu> listAll() {
        return sysMenuMapper.selectList(
                new LambdaQueryWrapper<SysMenu>()
                        .orderByAsc(SysMenu::getParentId, SysMenu::getSortOrder)
        );
    }

    /** 按 ID 获取菜单 */
    public SysMenu getById(Long id) {
        SysMenu menu = sysMenuMapper.selectById(id);
        if (menu == null) {
            throw new BusinessException("菜单不存在");
        }
        return menu;
    }

    /** 创建菜单 */
    @Transactional(rollbackFor = Exception.class)
    public SysMenu create(SysMenu menu) {
        applyDefaults(menu);
        sysMenuMapper.insert(menu);
        securityUserCacheService.evictAll();
        return menu;
    }

    /** 更新菜单 */
    @Transactional(rollbackFor = Exception.class)
    public SysMenu update(Long id, SysMenu updates) {
        SysMenu menu = getById(id);
        applyUpdates(menu, updates);
        sysMenuMapper.updateById(menu);
        securityUserCacheService.evictAll();
        return menu;
    }

    /** 删除菜单（逻辑删除） */
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        getById(id);
        Long childCount = sysMenuMapper.selectCount(
                new LambdaQueryWrapper<SysMenu>().eq(SysMenu::getParentId, id)
        );
        if (childCount > 0) {
            throw new BusinessException("存在子菜单，无法删除");
        }
        sysMenuMapper.deleteById(id);
        securityUserCacheService.evictAll();
    }

    private void applyDefaults(SysMenu menu) {
        if (menu.getSortOrder() == null) menu.setSortOrder(0);
        if (menu.getVisible() == null) menu.setVisible(1);
        if (menu.getStatus() == null) menu.setStatus(1);
        if (menu.getMenuType() == null) menu.setMenuType("M");
        if (menu.getIsFrame() == null) menu.setIsFrame(1);
        if (menu.getIsCache() == null) menu.setIsCache(1);
    }

    private void applyUpdates(SysMenu menu, SysMenu updates) {
        if (updates.getMenuName() != null) menu.setMenuName(updates.getMenuName());
        if (updates.getParentId() != null) menu.setParentId(updates.getParentId());
        if (updates.getSortOrder() != null) menu.setSortOrder(updates.getSortOrder());
        if (updates.getPath() != null) menu.setPath(updates.getPath());
        if (updates.getComponent() != null) menu.setComponent(updates.getComponent());
        if (updates.getQuery() != null) menu.setQuery(updates.getQuery());
        if (updates.getRouteName() != null) menu.setRouteName(updates.getRouteName());
        if (updates.getMenuType() != null) menu.setMenuType(updates.getMenuType());
        if (updates.getVisible() != null) menu.setVisible(updates.getVisible());
        if (updates.getStatus() != null) menu.setStatus(updates.getStatus());
        if (updates.getPerms() != null) menu.setPerms(updates.getPerms());
        if (updates.getIcon() != null) menu.setIcon(updates.getIcon());
        if (updates.getIsFrame() != null) menu.setIsFrame(updates.getIsFrame());
        if (updates.getIsCache() != null) menu.setIsCache(updates.getIsCache());
    }
}
