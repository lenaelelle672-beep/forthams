package com.ams.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * ATB-2: Annotation Existence Assertions & ATB-4: Field Completeness Assertions.
 * Verifies that the Location entity has correct MyBatis-Plus annotations
 * applied as per SPEC [WAVE2-001].
 */
class LocationAnnotationTest {

    @Test
    @DisplayName("ATB-2: Location class must have @TableName(\"location\")")
    void classShouldHaveTableNameAnnotation() {
        TableName annotation = Location.class.getAnnotation(TableName.class);
        assertNotNull(annotation, "Location 类必须标注 @TableName");
        assertEquals("location", annotation.value(),
                "@TableName 的值必须为 'location'");
    }

    @Test
    @DisplayName("ATB-2: name field must map to location_name column")
    void nameFieldShouldMapToLocationName() throws NoSuchFieldException {
        Field nameField = Location.class.getDeclaredField("name");
        TableField annotation = nameField.getAnnotation(TableField.class);
        assertNotNull(annotation, "name 字段必须标注 @TableField");
        assertEquals("location_name", annotation.value(),
                "@TableField 的值必须为 'location_name'");
    }

    @Test
    @DisplayName("ATB-2: parentId field must map to parent_id column")
    void parentIdFieldShouldMapToParentId() throws NoSuchFieldException {
        Field parentIdField = Location.class.getDeclaredField("parentId");
        TableField annotation = parentIdField.getAnnotation(TableField.class);
        assertNotNull(annotation, "parentId 字段必须标注 @TableField");
        assertEquals("parent_id", annotation.value(),
                "@TableField 的值必须为 'parent_id'");
    }

    @Test
    @DisplayName("ATB-4: Location entity must have exactly 10 business fields")
    void locationEntityShouldHaveExactlyTenFields() {
        Field[] fields = Location.class.getDeclaredFields();
        // Filter out instrumentation-injected fields (e.g. $jacocoData)
        long userFields = Arrays.stream(fields)
                .filter(f -> !f.getName().contains("$"))
                .count();
        assertEquals(10, userFields,
                "Location 实体必须且仅包含 10 个业务字段");
    }
}