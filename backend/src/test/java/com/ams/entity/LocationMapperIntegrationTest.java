package com.ams.entity;

import com.ams.mapper.LocationMapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * ATB-3: MyBatis-Plus SQL 映射集成测试
 * 验证 Location 实体与数据库 location 表的字段映射是否正确，
 * 特别是非标准命名转换（name -> location_name, parentId -> parent_id）。
 */
@SpringBootTest
@Transactional
class LocationMapperIntegrationTest {

    @Autowired
    private LocationMapper locationMapper;

    @Test
    void insertAndSelectShouldMapAllColumns() {
        Location entity = new Location();
        entity.setName("测试区域");
        entity.setLocationCode("TEST-001");
        entity.setParentId(0L);
        entity.setSortOrder(1);
        entity.setDescription("集成测试");
        entity.setStatus(1);

        locationMapper.insert(entity);
        assertNotNull(entity.getId(), "插入后 id 应自动回填");

        Location retrieved = locationMapper.selectById(entity.getId());
        assertNotNull(retrieved, "根据 id 应能查到记录");
        assertEquals("测试区域", retrieved.getName(),
            "name 字段应正确映射到 location_name 列");
        assertEquals(0L, retrieved.getParentId(),
            "parentId 字段应正确映射到 parent_id 列");
    }

    @Test
    void selectByNameViaWrapper() {
        QueryWrapper<Location> wrapper = new QueryWrapper<>();
        wrapper.eq("name", "某值");
        // 验证生成的 SQL 中 name 被正确解析为 location_name
        // 若映射错误，此处将抛出 SQL 异常
        assertDoesNotThrow(() -> locationMapper.selectList(wrapper));
    }
}