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
    void insert(Location location);

    @Update("UPDATE location SET name = #{name}, parent_id = #{parentId} WHERE id = #{id}")
    void update(Location location);

    @Delete("DELETE FROM location WHERE id = #{id}")
    void deleteById(Long id);

    @Select("SELECT * FROM location WHERE parent_id IS NULL")
    List<Location> findRootLocations();

    @Select("SELECT * FROM location WHERE parent_id = #{parentId}")
    List<Location> findChildrenByParentId(Long parentId);
}
