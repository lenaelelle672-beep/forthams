package com.ams.mapper;

import com.ams.entity.Dept;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 部门数据访问 Mapper 接口。
 * <p>
 * 提供部门表的 CRUD 操作，供 DeptController 通过注入使用。
 * 继承 MyBatis-Plus {@link BaseMapper} 自动获得以下核心方法：
 * <ul>
 *   <li>{@link BaseMapper#selectList} — 查询全部部门（平铺列表），用于 {@code GET /depts/list}</li>
 *   <li>{@link BaseMapper#selectById} — 根据 ID 查询单个部门</li>
 *   <li>{@link BaseMapper#insert} — 新增部门，用于 {@code POST /depts}</li>
 *   <li>{@link BaseMapper#updateById} — 根据 ID 更新部门，用于 {@code PUT /depts/{id}}</li>
 *   <li>{@link BaseMapper#deleteById} — 根据 ID 删除部门，用于 {@code DELETE /depts/{id}}</li>
 * </ul>
 * <p>
 * 注意：{@code GET /depts/tree} 端点所需的树形嵌套结构应在 Controller/Service 层
 * 通过获取平铺列表后基于 {@code parentId} 字段递归组装，而非在 Mapper 层处理。
 *
 * @see Dept
 * @see BaseMapper
 */
@Mapper
public interface DeptMapper extends BaseMapper<Dept> {

    // BaseMapper<Dept> 已提供全部所需 CRUD 方法，无需额外自定义 SQL。
    // 表名与字段映射由 Dept 实体类的 @TableName / @TableId / @TableField 注解决定。

}