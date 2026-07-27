package com.ams.mapper;

import com.ams.entity.Location;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface LocationMapper {

    @Select("SELECT id, name, location_code, parent_id, sort_order, description, status, create_time, update_time, deleted " +
            "FROM location WHERE id = #{id} AND deleted = 0")
    Location findById(Long id);

    @Insert("INSERT INTO location (name, location_code, parent_id, sort_order, description, status) " +
            "VALUES (#{name}, #{locationCode}, #{parentId}, #{sortOrder}, #{description}, #{status})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    void insert(Location location);

    @Update("UPDATE location SET name = #{name}, location_code = #{locationCode}, parent_id = #{parentId}, " +
            "sort_order = #{sortOrder}, description = #{description}, status = #{status} " +
            "WHERE id = #{id} AND deleted = 0")
    void update(Location location);

    @Update("UPDATE location SET deleted = 1 WHERE id = #{id}")
    void deleteById(Long id);

    @Select("WITH RECURSIVE cte AS ( " +
            "  SELECT id, name, location_code, parent_id, sort_order, description, status, create_time, update_time, deleted " +
            "  FROM location " +
            "  WHERE id = #{id} AND deleted = 0 " +
            "  UNION ALL " +
            "  SELECT l.id, l.name, l.location_code, l.parent_id, l.sort_order, l.description, l.status, l.create_time, l.update_time, l.deleted " +
            "  FROM location l " +
            "  INNER JOIN cte ON l.parent_id = cte.id " +
            "  WHERE l.deleted = 0 " +
            ") " +
            "SELECT * FROM cte ORDER BY sort_order, id")
    List<Location> findLocationHierarchy(@Param("id") Long id);

    @Select("SELECT id, name, location_code, parent_id, sort_order, description, status, create_time, update_time, deleted " +
            "FROM location WHERE parent_id IS NULL AND deleted = 0 ORDER BY sort_order, id")
    List<Location> findRootLocations();

    @Select("SELECT id, name, location_code, parent_id, sort_order, description, status, create_time, update_time, deleted " +
            "FROM location WHERE parent_id = #{parentId} AND deleted = 0 ORDER BY sort_order, id")
    List<Location> findChildrenByParentId(@Param("parentId") Long parentId);

    @Select("WITH RECURSIVE cte AS ( " +
            "  SELECT id, name, location_code, parent_id, sort_order, description, status, create_time, update_time, deleted " +
            "  FROM location " +
            "  WHERE id = #{id} AND deleted = 0 " +
            "  UNION ALL " +
            "  SELECT l.id, l.name, l.location_code, l.parent_id, l.sort_order, l.description, l.status, l.create_time, l.update_time, l.deleted " +
            "  FROM location l " +
            "  INNER JOIN cte ON l.parent_id = cte.id " +
            "  WHERE l.deleted = 0 " +
            ") " +
            "SELECT * FROM cte ORDER BY sort_order, id")
    List<Location> findDescendants(@Param("id") Long id);
}
