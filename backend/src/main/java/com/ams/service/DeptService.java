package com.ams.service;

import cn.hutool.core.bean.BeanUtil;
import cn.hutool.core.convert.Convert;
import com.ams.common.exception.BusinessException;
import com.ams.dto.DeptCreateDTO;
import com.ams.dto.DeptUpdateDTO;
import com.ams.entity.Dept;
import com.ams.mapper.DeptMapper;
import com.ams.mapper.UserMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
        wrapper.select("id", "dept_name", "dept_code", "parent_id", "sort_order", "leader", "phone", "status", "create_time");
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
        validateDeptCodeUnique(getStrProp(dto, "deptCode"), null);

        Dept dept = new Dept();
        BeanUtil.setProperty(dept, "name", getStrProp(dto, "name"));
        BeanUtil.setProperty(dept, "parentId", getLongProp(dto, "parentId") == null ? 0L : getLongProp(dto, "parentId"));
        BeanUtil.setProperty(dept, "orderNum", getIntProp(dto, "sortOrder") == null ? 0 : getIntProp(dto, "sortOrder"));
        BeanUtil.setProperty(dept, "status", "1");
        deptMapper.insert(dept);

        deptMapper.update(
            null,
            new UpdateWrapper<Dept>()
                .eq("id", getLongProp(dept, "id"))
                .set("dept_code", getStrProp(dto, "deptCode"))
                .set("leader", getStrProp(dto, "leader"))
                .set("phone", getStrProp(dto, "phone"))
        );
        return dept;
    }

    @Transactional(rollbackFor = Exception.class)
    public Dept updateDept(Long id, DeptUpdateDTO dto) {
        Dept dept = getDeptById(id);
        validateDeptCodeUnique(getStrProp(dto, "deptCode"), id);

        BeanUtil.setProperty(dept, "name", getStrProp(dto, "name"));
        BeanUtil.setProperty(dept, "parentId", getLongProp(dto, "parentId") == null ? 0L : getLongProp(dto, "parentId"));
        BeanUtil.setProperty(dept, "orderNum", getIntProp(dto, "sortOrder") == null ? 0 : getIntProp(dto, "sortOrder"));
        deptMapper.updateById(dept);

        deptMapper.update(
            null,
            new UpdateWrapper<Dept>()
                .eq("id", id)
                .set("dept_code", getStrProp(dto, "deptCode"))
                .set("leader", getStrProp(dto, "leader"))
                .set("phone", getStrProp(dto, "phone"))
        );
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
