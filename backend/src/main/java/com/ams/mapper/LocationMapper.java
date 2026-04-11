package com.ams.mapper;

import com.ams.entity.Location;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
public interface LocationMapper {

    @Select("SELECT * FROM location WHERE id = #{id}")
    Location findById(Long id);

    @Insert("INSERT INTO location (name, parent_id) VALUES (#{name}, #{parentId})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    void insert(Location location);

    @Update("UPDATE location SET name = #{name}, parent_id = #{parentId} WHERE id = #{id}")
    void update(Location location);

    @Delete("DELETE FROM location WHERE id = #{id}")
    void deleteById(Long id);

    @Select("WITH RECURSIVE cte AS ( " +
            "  SELECT id, name, parent_id " +
            "  FROM location " +
            "  WHERE id = #{id} " +
            "  UNION ALL " +
            "  SELECT l.id, l.name, l.parent_id " +
            "  FROM location l " +
            "  INNER JOIN cte ON l.parent_id = cte.id " +
            ") " +
            "SELECT * FROM cte ORDER BY id")
    List<Location> findLocationHierarchy(@Param("id") Long id);

    @Select("WITH RECURSIVE cte AS ( " +
            "  SELECT id, name, parent_id " +
            "  FROM location " +
            "  WHERE parent_id IS NULL " +
            "  UNION ALL " +
            "  SELECT l.id, l.name, l.parent_id " +
            "  FROM location l " +
            "  INNER JOIN cte ON l.parent_id = cte.id " +
            ") " +
            "SELECT * FROM cte ORDER BY id")
    List<Location> findRootLocations();

    @Select("WITH RECURSIVE cte AS ( " +
            "  SELECT id, name, parent_id " +
            "  FROM location " +
            "  WHERE parent_id = #{parentId} " +
            "  UNION ALL " +
            "  SELECT l.id, l.name, l.parent_id " +
            "  FROM location l " +
            "  INNER JOIN cte ON l.parent_id = cte.id " +
            ") " +
            "SELECT * FROM cte ORDER BY id")
    List<Location> findChildrenByParentId(@Param("parentId") Long parentId);

    @Select("WITH RECURSIVE cte AS ( " +
            "  SELECT id, name, parent_id " +
            "  FROM location " +
            "  WHERE id = #{id} " +
            "  UNION ALL " +
            "  SELECT l.id, l.name, l.parent_id " +
            "  FROM location l " +
            "  INNER JOIN cte ON l.parent_id = cte.id " +
            ") " +
            "SELECT * FROM cte ORDER BY id")
    List<Location> findDescendants(@Param("id") Long id);

    @Select("WITH RECURSIVE cte AS ( " +
            "  SELECT id, name, parent_id " +
            "  FROM location " +
            "  WHERE parent_id IS NULL " +
            "  UNION ALL " +
            "  SELECT l.id, l.name, l.parent_id " +
            "  FROM location l " +
            "  INNER JOIN cte ON l.parent_id = cte.id " +
            ") " +
            "SELECT * FROM cte ORDER BY id")
    List<Location> findRootLocations();

    @Select("WITH RECURSIVE cte AS ( " +
            "  SELECT id, name, parent_id " +
            "  FROM location " +
            "  WHERE parent_id = #{parentId} " +
            "  UNION ALL " +
            "  SELECT l.id, l.name, l.parent_id " +
            "  FROM location l " +
            "  INNER JOIN cte ON l.parent_id = cte.id " +
            ") " +
            "SELECT * FROM cte ORDER BY id")
    List<Location> findChildrenByParentId(@Param("parentId") Long parentId);

    @Select("WITH RECURSIVE cte AS ( " +
            "  SELECT id, name, parent_id " +
            "  FROM location " +
            "  WHERE id = #{id} " +
            "  UNION ALL " +
            "  SELECT l.id, l.name, l.parent_id " +
            "  FROM location l " +
            "  INNER JOIN cte ON l.parent_id = cte.id " +
            ") " +
            "SELECT * FROM cte ORDER BY id")
    List<Location> findDescendants(@Param("id") Long id);
}
