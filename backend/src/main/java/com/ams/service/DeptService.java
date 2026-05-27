package com.ams.service;

import com.ams.common.exception.BusinessException;
import com.ams.dto.DeptCreateDTO;
import com.ams.dto.DeptUpdateDTO;
import com.ams.entity.Dept;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.UserMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 部门管理 Service
 *
 * <p>使用显式 setter 赋值替代 Hutool BeanUtil 反射，确保类型安全与 IDE 重构检查。</p>
 */
@Service
public class DeptService {

    private final DeptMapper deptMapper;
    private final UserMapper userMapper;

    public DeptService(DeptMapper deptMapper, UserMapper userMapper) {
        this.deptMapper = deptMapper;
        this.userMapper = userMapper;
    }

    public List<Map<String, Object>> queryDepts(String keyword) {
        QueryWrapper<Dept> wrapper = new QueryWrapper<>();
        wrapper.select("id", "dept_name", "dept_code", "parent_id", "sort_order", "leader", "phone", "email", "status", "create_time");
        if (keyword != null && !keyword.isBlank()) {
            wrapper.and(w -> w.like("dept_name", keyword).or().like("dept_code", keyword));
        }
        wrapper.orderByAsc("sort_order", "id");

        List<Map<String, Object>> depts = deptMapper.selectMaps(wrapper);
        return buildDeptTree(depts);
    }

    public Dept getDeptById(Long id) {
        Dept dept = deptMapper.selectById(id);
        if (dept == null) {
            throw new BusinessException("部门不存在");
        }
        return dept;
    }

    @Transactional(rollbackFor = Exception.class)
    public Dept createDept(DeptCreateDTO dto) {
        validateDeptCodeUnique(dto.getDeptCode(), null);

        Dept dept = new Dept();
        dept.setName(dto.getName());
        dept.setParentId(dto.getParentId() != null ? dto.getParentId() : 0L);
        dept.setOrderNum(dto.getSortOrder() != null ? dto.getSortOrder() : 0);
        dept.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        dept.setDeptCode(dto.getDeptCode());
        dept.setLeader(dto.getLeader());
        dept.setPhone(dto.getPhone());
        dept.setEmail(dto.getEmail());
        dept.setLeaderId(dto.getLeaderId());
        dept.setSecretaryId(dto.getSecretaryId());
        dept.setDeptType(dto.getDeptType());
        dept.setDescription(dto.getDescription());
        deptMapper.insert(dept);

        return dept;
    }

    @Transactional(rollbackFor = Exception.class)
    public Dept updateDept(Long id, DeptUpdateDTO dto) {
        Dept dept = getDeptById(id);
        validateDeptCodeUnique(dto.getDeptCode(), id);

        dept.setName(dto.getName());
        dept.setParentId(dto.getParentId() != null ? dto.getParentId() : 0L);
        dept.setOrderNum(dto.getSortOrder() != null ? dto.getSortOrder() : 0);
        dept.setDeptCode(dto.getDeptCode());
        dept.setLeader(dto.getLeader());
        dept.setPhone(dto.getPhone());
        dept.setEmail(dto.getEmail());
        dept.setLeaderId(dto.getLeaderId());
        dept.setSecretaryId(dto.getSecretaryId());
        dept.setDeptType(dto.getDeptType());
        dept.setDescription(dto.getDescription());
        if (dto.getStatus() != null) {
            dept.setStatus(dto.getStatus());
        }
        deptMapper.updateById(dept);

        return dept;
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteDept(Long id) {
        getDeptById(id);
        Long userCount = userMapper.selectCount(new QueryWrapper<com.ams.entity.User>().eq("dept_id", id));
        if (userCount != null && userCount > 0) {
            throw new BusinessException("部门下存在用户，无法删除");
        }
        deptMapper.deleteById(id);
    }

    public List<Dept> listAllDepts() {
        List<Dept> depts = deptMapper.selectList(new QueryWrapper<Dept>().orderByAsc("sort_order", "id"));
        return buildDeptEntityTree(depts);
    }

    public List<Dept> listFlatDepts() {
        return deptMapper.selectList(new QueryWrapper<Dept>().orderByAsc("sort_order", "id"));
    }

    private void validateDeptCodeUnique(String deptCode, Long excludeId) {
        if (deptCode == null || deptCode.isBlank()) {
            return;
        }
        QueryWrapper<Dept> wrapper = new QueryWrapper<Dept>().eq("dept_code", deptCode);
        if (excludeId != null) {
            wrapper.ne("id", excludeId);
        }
        if (deptMapper.selectCount(wrapper) > 0) {
            throw new BusinessException("部门编码已存在");
        }
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

    private List<Dept> buildDeptEntityTree(List<Dept> deptList) {
        Map<Long, Dept> nodeMap = new HashMap<>();
        List<Dept> roots = new ArrayList<>();
        for (Dept dept : deptList) {
            dept.setChildren(new ArrayList<>());
            nodeMap.put(dept.getId(), dept);
        }
        for (Dept dept : deptList) {
            Long parentId = dept.getParentId();
            if (parentId == null || parentId == 0L || !nodeMap.containsKey(parentId)) {
                roots.add(dept);
                continue;
            }
            nodeMap.get(parentId).getChildren().add(dept);
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
}
