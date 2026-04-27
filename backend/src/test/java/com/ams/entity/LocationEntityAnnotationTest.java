package com.ams.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * WAVE2-001: Location Entity Annotation Verification Test
 * <p>
 * Validates that the Location entity has the required MyBatis-Plus mapping
 * annotations to correctly bind Java fields to database columns.
 */
@DisplayName("Location Entity Mapping Verification")
class LocationEntityAnnotationTest {

    @Test
    @DisplayName("G-1: Location 类必须标注 @TableName(\"location\")")
    void testTableNameAnnotation() {
        TableName annotation = Location.class.getAnnotation(TableName.class);
        assertNotNull(annotation, "Location 类必须标注 @TableName");
        assertEquals("location", annotation.value());
    }

    @Test
    @DisplayName("G-2: name 字段必须标注 @TableField(\"location_name\")")
    void testNameFieldMapping() throws NoSuchFieldException {
        Field nameField = Location.class.getDeclaredField("name");
        TableField tableField = nameField.getAnnotation(TableField.class);
        assertNotNull(tableField, "name 字段必须标注 @TableField");
        assertEquals("location_name", tableField.value());
    }

    @Test
    @DisplayName("G-3: parentId 字段必须标注 @TableField(\"parent_id\")")
    void testParentIdFieldMapping() throws NoSuchFieldException {
        Field parentIdField = Location.class.getDeclaredField("parentId");
        TableField tableField = parentIdField.getAnnotation(TableField.class);
        assertNotNull(tableField, "parentId 字段必须标注 @TableField");
        assertEquals("parent_id", tableField.value());
    }
}