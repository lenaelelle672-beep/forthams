package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.convert.Convert;
import com.ams.common.exception.BusinessException;
import com.ams.context.TenantContext;
import com.ams.dto.DeptCreateDTO;
import com.ams.dto.DeptUpdateDTO;
import com.ams.entity.Dept;
import com.ams.entity.RoleDataScopeRule;
import com.ams.entity.RoleDept;
import com.ams.entity.User;
import com.ams.entity.UserRole;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.AssetMapper;
import com.ams.mapper.RoleDataScopeMapper;
import com.ams.mapper.RoleDeptMapper;
import com.ams.mapper.UserMapper;
import com.ams.mapper.UserRoleMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.access.AccessDeniedException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class DeptService {

    private final DeptMapper deptMapper;
    private final AssetMapper assetMapper;
    private final UserMapper userMapper;
    private final RoleDeptMapper roleDeptMapper;
    private final RoleDataScopeMapper roleDataScopeMapper;
    private final UserRoleMapper userRoleMapper;
    private final TenantAuthorityService tenantAuthorityService;

    public DeptService(DeptMapper deptMapper, AssetMapper assetMapper, UserMapper userMapper, RoleDeptMapper roleDeptMapper,
                        RoleDataScopeMapper roleDataScopeMapper, UserRoleMapper userRoleMapper,
                        TenantAuthorityService tenantAuthorityService) {
        this.deptMapper = deptMapper;
        this.assetMapper = assetMapper;
        this.userMapper = userMapper;
        this.roleDeptMapper = roleDeptMapper;
        this.roleDataScopeMapper = roleDataScopeMapper;
        this.userRoleMapper = userRoleMapper;
        this.tenantAuthorityService = tenantAuthorityService;
    }

    public List<Map<String, Object>> queryDepts(String keyword) {
        String tenantId = TenantContext.requireTenantId();
        QueryWrapper<Dept> wrapper = scopedDeptQuery(tenantId)
                .select("id", "dept_name", "dept_code", "parent_id", "sort_order", "leader", "phone", "status", "create_time");
        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like("dept_name", keyword).or().like("dept_code", keyword));
        }
        wrapper.orderByAsc("sort_order", "id");

        List<Map<String, Object>> depts = deptMapper.selectMaps(wrapper);
        return buildDeptTree(depts);
    }

    public Dept getDeptById(Long id) {
        return getDeptById(id, TenantContext.requireTenantId());
    }

    @Transactional(rollbackFor = Exception.class)
    public Dept createDept(DeptCreateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        tenantAuthorityService.requireTenantAdmin();
        lockTenantDepartmentTree(tenantId);
        Long parentId = normalizeParentId(getLongProp(dto, "parentId"));
        validateParent(parentId, null, tenantId);
        validateDeptCodeUnique(getStrProp(dto, "deptCode"), null, tenantId);

        Dept dept = new Dept();
        dept.setTenantId(tenantId);
        dept.setName(getStrProp(dto, "name"));
        dept.setDeptCode(getStrProp(dto, "deptCode"));
        dept.setParentId(parentId);
        dept.setOrderNum(getIntProp(dto, "sortOrder") == null ? 0 : getIntProp(dto, "sortOrder"));
        dept.setLeader(getStrProp(dto, "leader"));
        dept.setPhone(getStrProp(dto, "phone"));
        dept.setStatus("1");
        dept.setVersion(0);
        if (deptMapper.insert(dept) != 1 || dept.getId() == null) {
            throw new BusinessException("部门创建失败");
        }
        return getDeptById(dept.getId(), tenantId);
    }

    @Transactional(rollbackFor = Exception.class)
    public Dept updateDept(Long id, DeptUpdateDTO dto) {
        String tenantId = TenantContext.requireTenantId();
        tenantAuthorityService.requireTenantAdmin();
        lockTenantDepartmentTree(tenantId);
        Dept dept = getDeptById(id, tenantId);
        int expectedVersion = versionOf(dept.getVersion());
        Long parentId = normalizeParentId(getLongProp(dto, "parentId"));
        validateParent(parentId, id, tenantId);
        if (!normalizeParentId(dept.getParentId()).equals(parentId)) {
            rejectDeptAndSubScopeExpansion(id, parentId, tenantId);
        }
        validateDeptCodeUnique(getStrProp(dto, "deptCode"), id, tenantId);

        dept.setName(getStrProp(dto, "name"));
        dept.setDeptCode(getStrProp(dto, "deptCode"));
        dept.setParentId(parentId);
        dept.setOrderNum(getIntProp(dto, "sortOrder") == null ? 0 : getIntProp(dto, "sortOrder"));
        dept.setLeader(getStrProp(dto, "leader"));
        dept.setPhone(getStrProp(dto, "phone"));
        dept.setVersion(expectedVersion + 1);
        int updated = deptMapper.update(dept, new UpdateWrapper<Dept>()
                .eq("id", id)
                .eq("tenant_id", tenantId)
                .eq("deleted", 0)
                .eq("version", expectedVersion));
        if (updated != 1) {
            throw new BusinessException("部门已变更，请刷新后重试");
        }
        return getDeptById(id, tenantId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteDept(Long id) {
        String tenantId = TenantContext.requireTenantId();
        tenantAuthorityService.requireTenantAdmin();
        lockTenantDepartmentTree(tenantId);
        Dept dept = getDeptById(id, tenantId);
        Long userCount = userMapper.selectCount(new QueryWrapper<User>()
                .eq("tenant_id", tenantId)
                .eq("dept_id", id));
        if (userCount != null && userCount > 0) {
            throw new BusinessException("部门下存在用户，无法删除");
        }
        Long childCount = deptMapper.selectCount(scopedDeptQuery(tenantId).eq("parent_id", id));
        if (childCount != null && childCount > 0) {
            throw new BusinessException("部门下存在子部门，无法删除");
        }
        Long roleDeptCount = roleDeptMapper.selectCount(new QueryWrapper<RoleDept>()
                .eq("tenant_id", tenantId)
                .eq("dept_id", id));
        if (roleDeptCount != null && roleDeptCount > 0) {
            throw new BusinessException("部门仍被角色数据范围引用，无法删除");
        }
        Long assetCount = assetMapper.countByTenantIdAndDeptIdIncludingDeleted(tenantId, id);
        if (assetCount != null && assetCount > 0) {
            throw new BusinessException("部门仍被资产引用，无法删除");
        }
        int deleted = deptMapper.delete(new QueryWrapper<Dept>()
                .eq("id", id)
                .eq("tenant_id", tenantId)
                .eq("deleted", 0)
                .eq("version", versionOf(dept.getVersion())));
        if (deleted != 1) {
            throw new BusinessException("部门已变更，请刷新后重试");
        }
    }

    public List<Dept> listAllDepts() {
        String tenantId = TenantContext.requireTenantId();
        return deptMapper.selectList(scopedDeptQuery(tenantId).orderByAsc("sort_order", "id"));
    }

    private Dept getDeptById(Long id, String tenantId) {
        if (id == null || id <= 0) {
            throw new BusinessException("部门不存在");
        }
        Dept dept = deptMapper.selectOne(scopedDeptQuery(tenantId).eq("id", id));
        if (dept == null) {
            throw new BusinessException("部门不存在");
        }
        return dept;
    }

    private void validateParent(Long parentId, Long currentDeptId, String tenantId) {
        if (parentId == 0L) {
            return;
        }
        if (parentId.equals(currentDeptId)) {
            throw new BusinessException("部门不能设置自身为上级部门");
        }

        Set<Long> visited = new HashSet<>();
        Long cursor = parentId;
        while (cursor != null && cursor != 0L) {
            if (!visited.add(cursor)) {
                throw new BusinessException("部门层级存在循环");
            }
            if (cursor.equals(currentDeptId)) {
                throw new BusinessException("不能将部门移动到其下级部门");
            }
            Dept parent = getDeptById(cursor, tenantId);
            if (!isEnabled(parent)) {
                throw new BusinessException("上级部门已停用");
            }
            cursor = parent.getParentId();
        }
    }

    private void validateDeptCodeUnique(String deptCode, Long excludeId, String tenantId) {
        if (deptCode == null || deptCode.isBlank()) {
            return;
        }
        QueryWrapper<Dept> wrapper = scopedDeptQuery(tenantId).eq("dept_code", deptCode);
        if (excludeId != null) {
            wrapper.ne("id", excludeId);
        }
        if (deptMapper.selectCount(wrapper) > 0) {
            throw new BusinessException("部门编码已存在");
        }
    }

    /**
     * 移动部门前比较所有 DEPT_AND_SUB 角色用户的可达部门集合。任一集合新增成员即拒绝，
     * 防止有部门编辑权限的租户管理员通过重挂将额外资产纳入既有下级范围。
     */
    private void rejectDeptAndSubScopeExpansion(Long movingDeptId, Long targetParentId, String tenantId) {
        List<RoleDataScopeRule> rules = roleDataScopeMapper.selectByTenantId(tenantId);
        Set<Long> deptAndSubRoleIds = new HashSet<>();
        if (rules != null) {
            for (RoleDataScopeRule rule : rules) {
                if (rule != null && rule.getRoleId() != null
                        && "DEPT_AND_SUB".equalsIgnoreCase(rule.getDataScope())) {
                    deptAndSubRoleIds.add(rule.getRoleId());
                }
            }
        }
        if (deptAndSubRoleIds.isEmpty()) {
            return;
        }

        List<UserRole> roleAssignments = userRoleMapper.selectList(new QueryWrapper<UserRole>()
                .in("role_id", deptAndSubRoleIds));
        Set<Long> userIds = new HashSet<>();
        if (roleAssignments != null) {
            for (UserRole assignment : roleAssignments) {
                if (assignment != null && assignment.getUserId() != null
                        && deptAndSubRoleIds.contains(assignment.getRoleId())) {
                    userIds.add(assignment.getUserId());
                }
            }
        }
        if (userIds.isEmpty()) {
            return;
        }

        List<User> scopedUsers = userMapper.selectList(new QueryWrapper<User>()
                .eq("tenant_id", tenantId)
                .eq("status", 1)
                .eq("deleted", 0)
                .in("id", userIds));
        List<Dept> departments = deptMapper.selectList(scopedDeptQuery(tenantId));
        Map<Long, Long> beforeParents = new HashMap<>();
        Set<Long> enabledDeptIds = new HashSet<>();
        if (departments != null) {
            for (Dept department : departments) {
                if (department != null && department.getId() != null && isEnabled(department)) {
                    beforeParents.put(department.getId(), normalizeParentId(department.getParentId()));
                    enabledDeptIds.add(department.getId());
                }
            }
        }
        if (!enabledDeptIds.contains(movingDeptId)) {
            throw new BusinessException("待移动部门不存在或已停用");
        }
        Map<Long, Long> afterParents = new HashMap<>(beforeParents);
        afterParents.put(movingDeptId, targetParentId);
        if (scopedUsers == null) {
            return;
        }
        for (User user : scopedUsers) {
            if (user == null || user.getDeptId() == null || !enabledDeptIds.contains(user.getDeptId())) {
                continue;
            }
            Set<Long> before = descendantsOf(user.getDeptId(), beforeParents);
            Set<Long> after = descendantsOf(user.getDeptId(), afterParents);
            after.removeAll(before);
            if (!after.isEmpty()) {
                throw new AccessDeniedException("重挂部门会扩大 DEPT_AND_SUB 数据范围，已拒绝");
            }
        }
    }

    private Set<Long> descendantsOf(Long rootDeptId, Map<Long, Long> parentsByDeptId) {
        Set<Long> result = new HashSet<>();
        result.add(rootDeptId);
        boolean changed;
        do {
            changed = false;
            for (Map.Entry<Long, Long> entry : parentsByDeptId.entrySet()) {
                if (result.contains(entry.getValue()) && result.add(entry.getKey())) {
                    changed = true;
                }
            }
        } while (changed);
        return result;
    }

    private QueryWrapper<Dept> scopedDeptQuery(String tenantId) {
        return new QueryWrapper<Dept>()
                .eq("tenant_id", tenantId)
                .eq("deleted", 0);
    }

    private Long normalizeParentId(Long parentId) {
        return parentId == null ? 0L : parentId;
    }

    private boolean isEnabled(Dept dept) {
        return "1".equals(dept.getStatus()) || "ACTIVE".equalsIgnoreCase(dept.getStatus());
    }

    /**
     * 锁住当前租户的部门图后再校验并写入父节点，避免两个并发重挂分别读取旧树而形成环。
     */
    private void lockTenantDepartmentTree(String tenantId) {
        deptMapper.selectList(scopedDeptQuery(tenantId).orderByAsc("id").last("FOR UPDATE"));
    }

    private int versionOf(Integer version) {
        return version == null ? 0 : version;
    }

    private List<Map<String, Object>> buildDeptTree(List<Map<String, Object>> deptList) {
        Map<Long, Map<String, Object>> nodeMap = new HashMap<>();
        List<Map<String, Object>> roots = new ArrayList<>();

        for (Map<String, Object> item : deptList) {
            item.put("children", new ArrayList<Map<String, Object>>());
            nodeMap.put(toLong(item.get("id")), item);
        }

        for (Map<String, Object> item : deptList) {
            Long parentId = toLong(item.get("parent_id"));
            if (parentId == null || parentId == 0L || !nodeMap.containsKey(parentId)) {
                roots.add(item);
                continue;
            }
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> children = (List<Map<String, Object>>) nodeMap.get(parentId).get("children");
            children.add(item);
        }
        return roots;
    }

    private Long toLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.valueOf(String.valueOf(value));
    }

    private Long getLongProp(Object bean, String fieldName) {
        return Convert.toLong(BeanUtil.getProperty(bean, fieldName));
    }

    private Integer getIntProp(Object bean, String fieldName) {
        return Convert.toInt(BeanUtil.getProperty(bean, fieldName));
    }

    private String getStrProp(Object bean, String fieldName) {
        return Convert.toStr(BeanUtil.getProperty(bean, fieldName));
    }
}
